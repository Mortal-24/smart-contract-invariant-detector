
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { inferCandidateInvariants } from "../../src/detector/candidateGenerator.js";

describe("Candidate invariant inference", () => {
  it("proposes a one-time claim limit from the reward pool", async () => {
    const source = await readFile(
      "contracts/research/VulnerableRewardPool.sol",
      "utf8"
    );

    const candidates = inferCandidateInvariants(source);

    console.log("\nReward-pool candidates:");
    console.log(JSON.stringify(candidates, null, 2));

    assert.ok(
      candidates.some(
        (candidate) => candidate.id === "ONE_TIME_CLAIM_LIMIT"
      ),
      "Expected a candidate one-time claim invariant"
    );
  });

  it("proposes an accounting invariant from the vault", async () => {
    const source = await readFile(
      "contracts/research/VulnerableAccountingVault.sol",
      "utf8"
    );

    const candidates = inferCandidateInvariants(source);

    console.log("\nAccounting candidates:");
    console.log(JSON.stringify(candidates, null, 2));

    assert.ok(
      candidates.some(
        (candidate) =>
          candidate.id === "WITHDRAWALS_WITHIN_DEPOSITS"
      ),
      "Expected a candidate accounting invariant"
    );
  });

  it("does not invent an invariant when no supported pattern exists", () => {
    const source = `
      pragma solidity ^0.8.34;
      contract Example {
        uint256 public temperature;
      }
    `;

    assert.deepEqual(inferCandidateInvariants(source), []);
  });
});
