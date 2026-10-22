
export type InvariantCandidate = {
  id: string;
  property: string;
  category: string;
  variables: string[];
  reason: string;
  confidence: "heuristic";
  evidence: string[];
  validationStatus: "candidate";
};

type MappingInfo = {
  name: string;
  valueType: string;
};

type FunctionInfo = {
  name: string;
  body: string;
  startLine: number;
};

function extractFunctionBodies(source: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  // Find function declarations. This is still a lightweight parser.
  const declarationPattern =
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)[^{;]*\{/g;

  for (const match of source.matchAll(declarationPattern)) {
    const openingBrace = match.index! + match[0].length - 1;

    // Match the closing brace by tracking nesting depth.
    let depth = 1;
    let position = openingBrace + 1;

    while (position < source.length && depth > 0) {
      if (source[position] === "{") depth++;
      if (source[position] === "}") depth--;
      position++;
    }

    if (depth !== 0) continue;

    const body = source.slice(openingBrace + 1, position - 1);
    const startLine =
      source.slice(0, match.index!).split("\n").length;

    functions.push({
      name: match[1],
      body,
      startLine,
    });
  }

  return functions;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMappings(source: string): MappingInfo[] {
  const mappings: MappingInfo[] = [];

  // Supports simple mappings whose key type is address.
  // This is heuristic parsing, not a complete Solidity parser.
  const pattern =
    /mapping\s*\(\s*address\s*=>\s*(bool|uint(?:8|16|32|64|128|256)?)\s*\)\s*(?:(?:public|private|internal)\s+)*(?:override\s+)?(\w+)\s*;/g;

  for (const match of source.matchAll(pattern)) {
    mappings.push({
      valueType: match[1],
      name: match[2],
    });
  }

  return mappings;
}

function findEvidence(
  source: string,
  pattern: RegExp
): string[] {
  return source
    .split(/\r?\n/)
    .map((line, index) => ({
      line: index + 1,
      text: line.trim(),
    }))
    .filter((item) => pattern.test(item.text))
    .map((item) => `Line ${item.line}: ${item.text}`);
}

function hasPattern(source: string, pattern: RegExp): boolean {
  return pattern.test(source);
}

export function inferCandidateInvariants(
  source: string
): InvariantCandidate[] {
  const mappings = extractMappings(source);
  const candidates: InvariantCandidate[] = [];

  // Rule 1: One-time claim limit.
  const claimCounter = mappings.find(
    (item) =>
      item.valueType.startsWith("uint") &&
      /bonusclaims|claimcount|claims/i.test(item.name)
  );

  const claimFlag = mappings.find(
    (item) =>
      item.valueType === "bool" &&
      /bonusclaimed|claimflag|claimed/i.test(item.name)
  );

  const hasClaimFunction = hasPattern(
    source,
    /\bfunction\s+\w*(?:claim|bonus|reward)\w*\s*\(/i
  );

  if (hasClaimFunction && (claimCounter || claimFlag)) {
    const variables = [
      ...(claimCounter ? [claimCounter.name] : []),
      ...(claimFlag ? [claimFlag.name] : []),
    ];

    candidates.push({
      id: "ONE_TIME_CLAIM_LIMIT",
      property: claimCounter
        ? `${claimCounter.name}[user] <= 1`
        : `${claimFlag!.name}[user] must not become true more than once`,
      category: "one-time-action",
      variables,
      reason:
        "A claim-related function and claim state were found. Verify whether the intended policy permits only one claim per user.",
      confidence: "heuristic",
      evidence: findEvidence(
        source,
        /\bfunction\s+\w*(?:claim|bonus|reward)\w*\s*\(|\b\w*(?:bonusclaims|claimcount|claims|bonusclaimed|claimflag|claimed)\w*\b/i
      ),
      validationStatus: "candidate",
    });
  }

  // Rule 1B: A different function resets a one-time claim flag.
  const functionInfos = extractFunctionBodies(source);

  for (const flag of mappings.filter(
    (item) =>
      item.valueType === "bool" &&
      /claimed|claimflag/i.test(item.name)
  )) {
    const escapedFlag = escapeRegex(flag.name);

    const claimFunction = functionInfos.find(
      (fn) =>
        /claim|bonus|reward/i.test(fn.name) &&
        new RegExp(
          `\\b${escapedFlag}\\s*\\[\\s*msg\\.sender\\s*\\]\\s*=\\s*true\\b`
        ).test(fn.body)
    );

    if (!claimFunction) continue;

    const resetFunction = functionInfos.find(
      (fn) =>
        fn.name !== claimFunction.name &&
        new RegExp(
          `\\b${escapedFlag}\\s*\\[\\s*msg\\.sender\\s*\\]\\s*=\\s*false\\b`
        ).test(fn.body)
    );

    if (!resetFunction) continue;

    candidates.push({
      id: "CROSS_FUNCTION_CLAIM_RESET",
      property:
        "A completed one-time claim must not become eligible again after another function executes.",
      category: "cross-function-state-transition",
      variables: [flag.name],
      reason:
        `Function ${resetFunction.name} resets ${flag.name} after ` +
        `the claim function ${claimFunction.name} consumes the flag. ` +
        "Check whether a multi-transaction sequence permits a repeated claim.",
      confidence: "heuristic",
      evidence: [
        `Function ${claimFunction.name}: sets ${flag.name}[msg.sender] = true`,
        `Function ${resetFunction.name}: sets ${flag.name}[msg.sender] = false`,
      ],
      validationStatus: "candidate",
    });
  }


  // Rule 2: Deposit and withdrawal accounting.
  const deposited = mappings.find(
    (item) =>
      item.valueType.startsWith("uint") &&
      /depositedtotal|totaldeposited|totaldeposits/i.test(item.name)
  );

  const withdrawn = mappings.find(
    (item) =>
      item.valueType.startsWith("uint") &&
      /withdrawntotal|totalwithdrawn|totalwithdrawals/i.test(item.name)
  );

  const hasDepositFunction = hasPattern(
    source,
    /\bfunction\s+\w*deposit\w*\s*\(/i
  );

  const hasWithdrawFunction = hasPattern(
    source,
    /\bfunction\s+\w*withdraw\w*\s*\(/i
  );

  if (hasDepositFunction && hasWithdrawFunction) {
    candidates.push({
      id: "WITHDRAWALS_WITHIN_DEPOSITS",
      property:
        deposited && withdrawn
          ? `${withdrawn.name}[user] <= ${deposited.name}[user]`
          : "Successful withdrawals must not exceed the user's available entitlement",
      category: "accounting",
      variables: [
        ...(deposited ? [deposited.name] : []),
        ...(withdrawn ? [withdrawn.name] : []),
      ],
      reason:
        "Deposit and withdrawal functions were found. Verify accounting updates and whether repeated withdrawals can exceed the user's entitlement.",
      confidence: "heuristic",
      evidence: findEvidence(
        source,
        /\bfunction\s+\w*(?:deposit|withdraw)\w*\s*\(|\b\w*(?:deposited|deposit|withdrawn|withdrawal|balance|totalDeposits|totalWithdrawals)\w*\b/i
      ),
      validationStatus: "candidate",
    });
  }

  // Rule 3: Claim flag and claim counter consistency.
  if (claimFlag && claimCounter) {
    candidates.push({
      id: "CLAIM_FLAG_COUNTER_RELATION",
      property:
        `${claimFlag.name}[user] == true when ${claimCounter.name}[user] > 0`,
      category: "state-consistency",
      variables: [claimFlag.name, claimCounter.name],
      reason:
        "A Boolean claim flag and numeric claim counter were found. Check whether they remain consistent across all relevant transaction sequences.",
      confidence: "heuristic",
      evidence: findEvidence(
        source,
        new RegExp(
          `\\b${claimFlag.name}\\b|\\b${claimCounter.name}\\b`
        )
      ),
      validationStatus: "candidate",
    });
  }

  // Rule 4: Oracle registration input validation.
  const hasOracleRegistration = hasPattern(
    source,
    /\bfunction\s+\w*(?:add|register|set)\w*oracle\w*\s*\(/i
  );

  const hasOracleMapping = hasPattern(
    source,
    /mapping\s*\(\s*address\s*=>\s*address\s*\)\s*(?:(?:public|private|internal)\s+)*(?:override\s+)?\w*oracle\w*\s*;/i
  );

  const hasZeroOracleCheck = hasPattern(
    source,
    /\brequire\s*\(\s*_oracle\s*!=\s*address\s*\(\s*0\s*\)/i
  );

  if (hasOracleRegistration && hasOracleMapping) {
    candidates.push({
      id: "ORACLE_ADDRESS_VALIDATION",
      property:
        "A registered oracle address must not be address(0)",
      category: "input-validation",
      variables: ["assetOracles"],
      reason: hasZeroOracleCheck
        ? "An explicit zero-address check was found. Verify that all registration paths enforce it before state changes."
        : "An oracle registration function and oracle mapping were found, but the expected zero-address check was not recognized. Review the function manually.",
      confidence: "heuristic",
      evidence: findEvidence(
        source,
        /\bfunction\s+\w*(?:add|register|set)\w*oracle\w*\s*\(|mapping\s*\(\s*address\s*=>\s*address\s*\)|_oracle\s*!=\s*address\s*\(\s*0\s*\)|assets\.push|assetOracles\s*\[/i
      ),
      validationStatus: "candidate",
    });
  }

  return candidates;
}
