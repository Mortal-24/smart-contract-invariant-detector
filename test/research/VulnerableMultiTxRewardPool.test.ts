
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("VulnerableMultiTxRewardPool", () => {
  it("reproduces repeated bonus claims across transactions", async () => {
    const { viem } = await network.connect();

    const [user] = await viem.getWalletClients();

    const pool = await viem.deployContract(
      "VulnerableMultiTxRewardPool"
    );

    // Transaction 1: deposit
    await pool.write.deposit([], {
      account: user.account,
      value: parseEther("1"),
    });

    // Transaction 2: claim the bonus for the first time
    await pool.write.claimBonus([], {
      account: user.account,
    });

    // Transaction 3: withdraw, which resets bonusClaimed
    await pool.write.withdraw([], {
      account: user.account,
    });

    // Transaction 4: deposit again
    await pool.write.deposit([], {
      account: user.account,
      value: parseEther("1"),
    });

    // Transaction 5: claim the bonus a second time
    await pool.write.claimBonus([], {
      account: user.account,
    });

    const claims = await pool.read.bonusClaims([
      user.account.address,
    ]);

    const claimed = await pool.read.bonusClaimed([
      user.account.address,
    ]);

    const rewards = await pool.read.rewardBalance([
      user.account.address,
    ]);

    console.log("Transaction sequence:");
    console.log("deposit -> claimBonus -> withdraw -> deposit -> claimBonus");
    console.log("Bonus claims:", claims.toString());
    console.log("Claim flag:", claimed);
    console.log("Reward balance:", rewards.toString());

    // Demonstrate that the lifetime one-time policy was violated.
    assert.equal(claims, 2n);
    assert.equal(claimed, true);
    assert.equal(rewards, 200n);
  });
});
