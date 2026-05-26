const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ExpiryRefundModule (Mode 1 — D12)", function () {
  const ONE_HOUR = 3600;
  const AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDT (6 decimals)

  async function fixture() {
    const [deployer, partyA, partyB, keeper] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("MockERC20");
    const usdt = await ERC20.deploy("Tether USD", "USDT", 6);

    const Safe = await ethers.getContractFactory("MockSafe");
    const safe = await Safe.deploy();

    const Mod = await ethers.getContractFactory("ExpiryRefundModule");
    const mod = await Mod.deploy();

    const modAddr = await mod.getAddress();
    const safeAddr = await safe.getAddress();
    const usdtAddr = await usdt.getAddress();

    const now = await time.latest();
    const deadline = now + ONE_HOUR;

    // helper: have the Safe call configure() on the module (msg.sender == safe)
    async function configure(refundTo, asset, dl) {
      const data = mod.interface.encodeFunctionData("configure", [refundTo, asset, dl]);
      return safe.exec(modAddr, data);
    }

    return { deployer, partyA, partyB, keeper, usdt, safe, mod, modAddr, safeAddr, usdtAddr, deadline, configure };
  }

  describe("configure", function () {
    it("stores config when called by the Safe", async function () {
      const { mod, safeAddr, usdtAddr, partyA, deadline, configure } = await fixture();
      await configure(partyA.address, usdtAddr, deadline);
      const c = await mod.getConfig(safeAddr);
      expect(c.refundTo).to.equal(partyA.address);
      expect(c.asset).to.equal(usdtAddr);
      expect(c.deadline).to.equal(deadline);
      expect(c.configured).to.equal(true);
      expect(c.done).to.equal(false);
    });

    it("reverts if configured twice", async function () {
      const { mod, usdtAddr, partyA, deadline, configure } = await fixture();
      await configure(partyA.address, usdtAddr, deadline);
      await expect(configure(partyA.address, usdtAddr, deadline)).to.be.reverted; // AlreadyConfigured (wrapped by MockSafe)
    });

    it("reverts on zero refundTo", async function () {
      const { usdtAddr, deadline, configure } = await fixture();
      await expect(configure(ethers.ZeroAddress, usdtAddr, deadline)).to.be.reverted;
    });

    it("reverts when deadline is not in the future", async function () {
      const { usdtAddr, partyA, configure } = await fixture();
      const past = (await time.latest()) - 1;
      await expect(configure(partyA.address, usdtAddr, past)).to.be.reverted;
    });
  });

  describe("refund — ERC20", function () {
    it("reverts before the deadline", async function () {
      const { mod, safe, safeAddr, usdt, usdtAddr, partyA, keeper, deadline, configure } = await fixture();
      await configure(partyA.address, usdtAddr, deadline);
      await safe.enableModule(await mod.getAddress());
      await usdt.mint(safeAddr, AMOUNT);
      await expect(mod.connect(keeper).refund(safeAddr)).to.be.revertedWithCustomError(mod, "NotExpired");
    });

    it("refunds the full balance to party A after the deadline (permissionless)", async function () {
      const { mod, safe, safeAddr, usdt, usdtAddr, partyA, keeper, deadline, configure } = await fixture();
      await configure(partyA.address, usdtAddr, deadline);
      await safe.enableModule(await mod.getAddress());
      await usdt.mint(safeAddr, AMOUNT);

      await time.increaseTo(deadline + 1);

      await expect(mod.connect(keeper).refund(safeAddr))
        .to.emit(mod, "Refunded")
        .withArgs(safeAddr, partyA.address, usdtAddr, AMOUNT);

      expect(await usdt.balanceOf(safeAddr)).to.equal(0n);
      expect(await usdt.balanceOf(partyA.address)).to.equal(AMOUNT);
    });

    it("cannot be refunded twice", async function () {
      const { mod, safe, safeAddr, usdt, usdtAddr, partyA, keeper, deadline, configure } = await fixture();
      await configure(partyA.address, usdtAddr, deadline);
      await safe.enableModule(await mod.getAddress());
      await usdt.mint(safeAddr, AMOUNT);
      await time.increaseTo(deadline + 1);
      await mod.connect(keeper).refund(safeAddr);
      await expect(mod.connect(keeper).refund(safeAddr)).to.be.revertedWithCustomError(mod, "AlreadyDone");
    });

    it("reverts if the safe is not configured", async function () {
      const { mod, safeAddr, keeper } = await fixture();
      await expect(mod.connect(keeper).refund(safeAddr)).to.be.revertedWithCustomError(mod, "NotConfigured");
    });

    it("reverts if the module is not enabled on the Safe", async function () {
      const { mod, safeAddr, usdt, usdtAddr, partyA, keeper, deadline, configure } = await fixture();
      await configure(partyA.address, usdtAddr, deadline);
      // NOTE: module intentionally NOT enabled
      await usdt.mint(safeAddr, AMOUNT);
      await time.increaseTo(deadline + 1);
      await expect(mod.connect(keeper).refund(safeAddr)).to.be.reverted; // MockSafe GS104
    });

    it("reverts when there is nothing to refund", async function () {
      const { mod, safe, safeAddr, usdtAddr, partyA, keeper, deadline, configure } = await fixture();
      await configure(partyA.address, usdtAddr, deadline);
      await safe.enableModule(await mod.getAddress());
      await time.increaseTo(deadline + 1);
      await expect(mod.connect(keeper).refund(safeAddr)).to.be.revertedWithCustomError(mod, "NothingToRefund");
    });
  });

  describe("refund — native ETH", function () {
    it("refunds the full ETH balance to party A after the deadline", async function () {
      const { mod, safe, safeAddr, partyA, keeper, deadline, configure, deployer } = await fixture();
      await configure(partyA.address, ethers.ZeroAddress, deadline);
      await safe.enableModule(await mod.getAddress());

      const value = ethers.parseEther("2");
      await deployer.sendTransaction({ to: safeAddr, value });

      await time.increaseTo(deadline + 1);

      const before = await ethers.provider.getBalance(partyA.address);
      await mod.connect(keeper).refund(safeAddr); // keeper pays gas, not party A
      const after = await ethers.provider.getBalance(partyA.address);

      expect(after - before).to.equal(value);
      expect(await ethers.provider.getBalance(safeAddr)).to.equal(0n);
    });
  });
});
