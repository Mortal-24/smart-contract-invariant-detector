
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Multi-transaction accounting invariant", async function () {
  const { viem } = await network.create();
  const [walletClient] = await viem.getWalletClients();
  const user = walletClient.account.address;

  it("detects repeated withdrawals in the vulnerable contract", async function () {
    const vault = await viem.deployContract(
      "VulnerableAccountingVault"
    );

    await vault.write.deposit([100n]);
    await vault.write.withdraw([80n]);
    await vault.write.withdraw([80n]);

    const deposited = await vault.read.depositedTotal([user]);
    const withdrawn = await vault.read.withdrawnTotal([user]);

    assert.equal(deposited, 100n);
    assert.equal(withdrawn, 0n);

    // The contract accepted 160 units of withdrawals
    // against a deposit of only 100 units.
    console.log("Detected: accounting allows repeated withdrawals.");
  });

  it("blocks excessive withdrawals in the fixed contract", async function () {
    const vault = await viem.deployContract(
      "FixedAccountingVault"
    );

    await vault.write.deposit([100n]);
    await vault.write.withdraw([80n]);

    await assert.rejects(async () => {
      await vault.write.withdraw([80n]);
    });

    assert.equal(await vault.read.depositedTotal([user]), 100n);
    assert.equal(await vault.read.withdrawnTotal([user]), 80n);

    console.log("Confirmed: the fixed contract blocks over-withdrawal.");
  });
});