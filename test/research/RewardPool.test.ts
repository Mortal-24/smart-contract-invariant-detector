import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Multi-transaction bonus invariant", async function () {
  const { viem } = await network.create();
  const [walletClient] = await viem.getWalletClients();
  const user = walletClient.account.address;

  it("detects a repeated bonus claim in the vulnerable contract", async function () {
    const pool = await viem.deployContract("VulnerableRewardPool");

    // Transaction 1: become eligible.
    await pool.write.deposit();

    // Transaction 2: claim the bonus for the first time.
    await pool.write.claimBonus();

    // Transaction 3: withdraw, incorrectly resetting eligibility.
    await pool.write.withdraw();

    // Transaction 4: become eligible again.
    await pool.write.deposit();

    // Transaction 5: exploit the reset and claim again.
    await pool.write.claimBonus();

    assert.equal(await pool.read.bonusClaims([user]), 2n);
    assert.equal(await pool.read.rewardBalance([user]), 200n);

    console.log("Detected: the user claimed the one-time bonus twice.");
  });

  it("confirms that the fixed contract blocks the repeated claim", async function () {
    const pool = await viem.deployContract("FixedRewardPool");

    await pool.write.deposit();
    await pool.write.claimBonus();
    await pool.write.withdraw();
    await pool.write.deposit();

    // The second claim must revert.
    await assert.rejects(async () => {
      await pool.write.claimBonus();
    });

    assert.equal(await pool.read.bonusClaims([user]), 1n);
    assert.equal(await pool.read.rewardBalance([user]), 100n);

    console.log("Confirmed: the fixed contract prevents a second claim.");
  });
});