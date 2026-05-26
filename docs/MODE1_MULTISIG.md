# Mode 1 — 2-of-3 공동 멀티시그 에스크로 기술 설계

> 상위 명세: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (§3, D1·D6·D9·D11·D12·D13·D14). 본 문서는 그 §3을 **구현 가능한 수준**으로 구체화한다. 코드 감사 시 본 문서를 Mode 1 체크리스트로 사용한다.
>
> - 버전: `v0.1` / 최종 수정: 2026-05-26

---

## 1. 설계 원칙

1. **비수탁(non-custodial)**: 거래 자산은 거래별 전용 **Gnosis Safe**(2-of-3)에 있고, 플랫폼(법인)은 키 1개뿐이라 단독 출금 불가.
2. **커스텀 컨트랙트 최소화**: 표준 Safe + 검증된 모듈만 사용해 감사 표면을 줄인다. 신규 솔리디티는 **타임락 환불 모듈(D12)** 하나로 한정한다.
3. **법인은 평시 무관여**: 정상 거래에서 법인 키는 서명하지 않는다. 분쟁·만료에서만 개입.

---

## 2. 구성요소

| 요소 | 기술 | 비고 |
|---|---|---|
| 거래별 지갑 | **Gnosis Safe** (Safe{Core} Protocol Kit) | owners=[A, B, LLC], threshold=2 |
| Safe 배포 | `SafeProxyFactory` (CREATE2 결정적 주소) | A가 가스 부담 (D13) |
| 법인 키 | **MPC 지갑 (Fireblocks 등)** (D11) | TSS 분산 서명, 단일 노출점 없음 |
| 자산 | USDT (ERC-20) | 판매자 A가 Safe로 예치 |
| 타임락 환불 | 커스텀 **Safe Module** `ExpiryRefundModule` | 데드라인 후 A 환불 전용 (D12) |
| 수수료 | Safe 출금 **배치 트랜잭션** 내 출력 (D9) | 부담 주체는 pool별 pay/receive |
| 오프체인 | 매칭, MPC 서명 서비스, 거래 인덱서 | §7 |

> ※ Safe SDK: `@safe-global/protocol-kit`, `@safe-global/api-kit`, `@safe-global/safe-core-sdk-types`. USDT는 Safe의 ERC-20 전송으로 처리.

---

## 3. 거래 생애주기 (상태 머신 구현)

```
[CREATED]  A·B 매칭 → CREATE2로 Safe 주소 예측·배포 (owners=[A,B,LLC], thr=2)
   │         · A가 가스 부담 (D13)
   │         · ExpiryRefundModule 활성화 (deadline, refundTo=A 고정)
   ▼
[FUNDED]   A가 USDT를 Safe로 예치 (단순 ERC-20 transfer)
   │         · 인덱서가 입금 감지 → 상태 FUNDED, B에게 알림
   ▼
   ├─ 정상: B가 오프라인으로 A에게 법정화폐 송금
   │        → A·B가 "출금 배치"에 각자 서명 (2/3)
   │        → Safe 실행: [USDT→B] + [수수료→feeRecipient]  ⇒ [RELEASED]
   │
   ├─ 분쟁: 한쪽이 서명 거부 → 피해자가 중재 요청(§5)
   │        → 법인 MPC 키 + 정당측 키 서명 (2/3)
   │        → Safe 실행: USDT→정당측 + 수수료  ⇒ [RESOLVED]
   │
   └─ 만료: 데드라인 경과 & 미정산
            → KEEPER가 ExpiryRefundModule.refund(safe) 호출 (권한 없는 자도 호출 가능, 목적지 고정)
            → 모듈이 Safe의 USDT를 refundTo(A)로 전송  ⇒ [EXPIRED→REFUNDED]
```

### 부분체결 (D14)
- Mode 1의 부분체결은 **여러 번의 출금 배치**로 구현한다. 각 부분 정산마다 A·B(또는 분쟁 시 법인+정당측)가 `[USDT 일부→B] + [비례 수수료→feeRecipient]` 배치에 서명·실행.
- **잔여분 추적**: 온체인 잔액(Safe의 USDT balance)을 단일 진실로 삼는다. 인덱서는 누적 정산액·잔여 약정액을 오프체인에 기록하되, **정산 가능 상한 = Safe 잔액**으로 강제. 잔여가 0이 되면 RELEASED.
- ⚠️ 부분체결은 각 배치마다 2/3 서명이 필요 → UX·회계 복잡. MVP에서는 **전량 1회**를 기본 노출하고, 부분체결은 옵션으로 둔다.

---

## 4. ExpiryRefundModule (유일한 커스텀 컨트랙트)

데드라인 경과 시 **A에게만, Safe에 든 자산을 환불**하는 Safe 모듈. 다른 동작은 불가능해 신뢰가정을 최소화한다.

```solidity
// 의사코드 — 감사 대상
contract ExpiryRefundModule {
    struct Cfg { address safe; address refundTo; address asset; uint256 deadline; bool done; }
    mapping(address => Cfg) public cfg;          // safe => config

    // Safe가 setup 시 호출 (모듈 활성화 후, owner 트랜잭션으로 1회 설정)
    function configure(address refundTo, address asset, uint256 deadline) external {
        require(cfg[msg.sender].safe == address(0), "set");   // msg.sender == Safe
        cfg[msg.sender] = Cfg(msg.sender, refundTo, asset, deadline, false);
    }

    // 누구나 호출 가능하나 목적지·동작이 고정 → 권한 불요(키퍼/A 본인 등)
    function refund(address safe) external {
        Cfg storage c = cfg[safe];
        require(block.timestamp > c.deadline && !c.done, "early/done");
        c.done = true;
        uint256 bal = IERC20(c.asset).balanceOf(safe);
        // Safe 모듈 권한으로 execTransactionFromModule
        ISafe(safe).execTransactionFromModule(
            c.asset, 0, abi.encodeWithSelector(IERC20.transfer.selector, c.refundTo, bal), 0 /*Call*/
        );
    }
}
```

**보안 속성**
- 목적지 `refundTo`는 설정 시 **A로 고정**, 변경 함수 없음 → 모듈이 자금을 탈취 불가.
- `deadline` 이전엔 실행 불가, 1회만(`done`).
- 모듈은 `transfer`만 호출 → 임의 호출 불가.
- ⚠️ 감사 포인트: `configure`가 Safe 자신에 의해서만 호출되는지, 재설정 불가인지, 부분체결로 잔액이 변해도 안전한지(잔액 전체 환불) 검증.

> 대안(모듈 없이): 데드라인 후 법인+A 2/3 서명으로 수동 환불. 단 A가 무응답이면 막힘 → D12("양측 무응답") 충족 못 함. 따라서 **모듈 채택**.

---

## 5. 분쟁·중재 (MPC)

```
1. 피해자(예: B)가 앱에서 "중재 요청" → 분쟁 레코드 생성(Supabase) + 선택적 증거(D10: 증빙 비강제)
2. 법인 중재자가 검토 → 판정(정당측 = B 또는 A)
3. 법인 MPC 서비스가 "USDT→정당측 + 수수료→feeRecipient" Safe 트랜잭션에 서명
4. 정당측이 자신의 키로 공동서명 (2/3) → 실행
   · 정당측이 협조 안 하면? 법인 단독으론 2/3 불충족 → 실행 불가(설계상 정당측은 자기 이익이라 서명함)
```
- **MPC 정책**: 중재 서명은 다중 승인(법인 내부 N-of-M MPC 정책)으로만 발동. 모든 중재 서명은 감사 로그.
- 증거는 비강제(D10)이나, 첨부 시 IPFS 해시를 분쟁 레코드에 보관.

---

## 6. 수수료 처리 (D9)

- 수수료는 **출금 배치의 한 출력**으로 처리: `[USDT(수량-수수료)→수령자] + [수수료→feeRecipient]`.
- 부담 주체(pool별 pay/receive):
  - **receive(상대에게서 받음)**: 수령자가 받을 금액에서 수수료 차감.
  - **pay(내가 냄)**: 생성자 몫에서 충당(생성자가 예치 시 수수료분 추가 예치 또는 정산 시 생성자 환급분에서 차감).
- 금액·율은 **거래별 설정(D7)**, 전역 max 가드 내. 서명자는 배치의 수수료 출력 값을 확인 후 서명한다(투명).

---

## 7. 오프체인 컴포넌트

| 서비스 | 역할 |
|---|---|
| **Safe 배포/조정 API** | Protocol Kit으로 예측주소·배포·모듈 설정 트랜잭션 빌드 |
| **MPC 서명 서비스** | 법인 키(Fireblocks). 분쟁/만료 서명. 정책 기반 승인 + 감사 로그 |
| **입금 인덱서** | Safe USDT 입금 감지 → FUNDED 전이, 잔여 추적(부분체결) |
| **Keeper** | 데드라인 경과 Safe에 `ExpiryRefundModule.refund` 호출 |
| **분쟁 레코드** | Supabase(`disputes`) + IPFS 증거 해시(선택) |

---

## 8. 데이터 모델 (오프체인, Supabase)

```
trades(id, mode='MULTISIG', pool_id, party_a, party_b, safe_address,
       asset, amount, fee_amount, fee_bearer, deadline,
       status[CREATED|FUNDED|RELEASED|DISPUTED|RESOLVED|EXPIRED],
       created_at)
disputes(id, trade_id, raised_by, evidence_ipfs nullable, ruling nullable,
         arbiter, resolved_at)
```
> 온체인이 진실, Supabase는 인덱스/UX 캐시. 자금 상태는 항상 Safe 잔액·상태로 재검증 가능해야 한다.

---

## 9. 보안 체크리스트 (감사용)

- [ ] Safe owners/threshold가 정확히 [A,B,LLC]/2 로 배포되는가 (배포 트랜잭션 검증).
- [ ] 법인 키가 단독으로 자금을 못 빼는가 (threshold=2 불변).
- [ ] `ExpiryRefundModule`: 목적지 고정(A), 재설정 불가, 데드라인 전 실행 불가, 1회성, `transfer`만.
- [ ] 모듈이 Safe에 **올바르게 enable** 되고, 그 외 모듈/guard가 없는지.
- [ ] 수수료 출력이 배치에 정확히 포함되고 서명자에게 노출되는가 (숨은 출력 없음).
- [ ] 부분체결 시 잔여분 = Safe 잔액으로만 정산 가능 (오프체인 수치 신뢰 금지).
- [ ] MPC 서명이 다중승인·감사로그로만 발동되는가.
- [ ] CREATE2 주소 선예측 후 입금하는 프론트에서, 배포 전 입금/재배포 공격(주소 선점) 방어.
- [ ] USDT의 비표준 동작(수수료 토큰/블랙리스트/허가)에 대한 가정 점검.

---

## 10. 구현 단계 (진행 현황)

- [ ] 1. Safe Protocol Kit 연동 — 예측주소·배포·모듈 enable 트랜잭션 빌더 (`src/lib/safe/*`).
- [x] 2. **`ExpiryRefundModule.sol` 작성 + 단위테스트 (완료)** — `contracts/src/ExpiryRefundModule.sol`, 테스트 `contracts/test/ExpiryRefundModule.test.js` 11개 통과. 감사는 A 단계에서.
- [ ] 3. 입금 인덱서 + Keeper (오프체인 워커).
- [ ] 4. MPC(Fireblocks) 중재 서명 서비스 + 어드민 분쟁 화면 연동.
- [ ] 5. 프론트: Mode 1 거래 생성/예치/서명 UX (wagmi + Safe SDK).

### 컨트랙트 워크스페이스 (신규)
- `contracts/package.json` — Hardhat + toolbox + OpenZeppelin v5.
- `hardhat.config.js`: `paths.sources = ./src`, `solidity.settings.viaIR = true`
  (레거시 `EscrowVault.createEscrow`의 "stack too deep" 회피).
- `PoolRegistry.sol`의 사용되지 않던 `UUPSUpgradeable` import 제거(컴파일 가능화 — 감사 발견 항목).
- 실행: `cd contracts && npm install && npx hardhat test`.
