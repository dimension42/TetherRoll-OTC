import { z } from 'zod';
import { AuthError } from '@/lib/auth/guards';
import { SUPPORTED_CHAIN_IDS } from '@/lib/chains';

/**
 * zod 스키마 기반 입력 검증. 실패 시 AuthError(400, ...) throw.
 */

/** 0x + 40 hex, lowercase */
export const zAddress = z.string().regex(/^0x[0-9a-f]{40}$/, 'Invalid address').transform(v => v.toLowerCase());

/** 양의 정수 문자열 (bigint) */
export const zBigIntStr = z.string().regex(/^\d+$/, 'Invalid bigint string');

/** 지원 체인 ID */
export const zChainId = z.number().refine(id => SUPPORTED_CHAIN_IDS.includes(id), 'Unsupported chainId');

/** UUID v4 */
export const zUuid = z.string().uuid();

/** Request body 파싱 — zod 스키마 */
export async function parseBody<T>(req: Request, schema: z.ZodSchema<T>): Promise<T> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new AuthError(400, 'Invalid input');
    }
    throw new AuthError(400, 'Malformed JSON');
  }
}

/** Query params 파싱 */
export function parseQuery<T>(url: URL, schema: z.ZodSchema<T>): T {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: Record<string, any> = Object.fromEntries(url.searchParams.entries());
    // 숫자 필드 자동 변환
    Object.keys(raw).forEach(k => {
      if (/^\d+$/.test(raw[k])) raw[k] = Number(raw[k]);
    });
    return schema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new AuthError(400, 'Invalid query params');
    }
    throw e;
  }
}
