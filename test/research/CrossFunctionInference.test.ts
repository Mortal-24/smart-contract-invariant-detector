
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  inferCandidateInvariants,
} from "../../src/detector/candidateGenerator.js";

describe("Cross-function invariant inference", () => {
  it("detects a claim flag reset in the vulnerable contract", async () => {
    const source = await readFile(
      "contracts/research/VulnerableRewardPool.sol",
      "utf8"
    );

    const candidates = inferCandidateInvariants(source);

    assert.ok(
      candidates.some(
        (candidate) =>
          candidate.id === "CROSS_FUNCTION_CLAIM_RESET"
      ),
      "Expected a candidate for the cross-function flag reset"
    );
  });

  it("does not report that reset in the fixed contract", async () => {
    const source = await readFile(
      "contracts/research/FixedRewardPool.sol",
      "utf8"
    );

    const candidates = inferCandidateInvariants(source);

    assert.equal(
      candidates.some(
        (candidate) =>
          candidate.id === "CROSS_FUNCTION_CLAIM_RESET"
      ),
      false,
      "The fixed contract should not trigger this specific heuristic"
    );
  });
});
