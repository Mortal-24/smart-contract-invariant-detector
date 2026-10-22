
import { readFile } from "node:fs/promises";
import path from "node:path";
import { inferCandidateInvariants } from "../src/detector/candidateGenerator.js";

type SourceItem = {
  name: string;
  line: number;
  declaration: string;
};

function extractItems(source: string) {
  const contracts: SourceItem[] = [];
  const functions: SourceItem[] = [];
  const stateVariables: SourceItem[] = [];

  const lines = source.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const lineNumber = index + 1;

    const contractMatch = line.match(
      /\b(?:contract|abstract\s+contract|interface|library)\s+(\w+)/
    );

    if (contractMatch) {
      contracts.push({
        name: contractMatch[1],
        line: lineNumber,
        declaration: line,
      });
    }

    const functionMatch = line.match(
      /\bfunction\s+(\w+)\s*\(|\bconstructor\s*\(/
    );

    if (functionMatch) {
      functions.push({
        name: functionMatch[1] ?? "constructor",
        line: lineNumber,
        declaration: line,
      });
    }

    // First-pass extraction of public state declarations.
    // This is intentionally heuristic, not a full Solidity parser.
    const stateMatch = line.match(
      /\b(?:mapping\s*\([^;]+\)|uint(?:8|16|32|64|128|256)?|int(?:8|16|32|64|128|256)?|bool|address|string|bytes(?:\d+)?)\s+public\s+(\w+)\s*(?:[;=])/
    );

    if (stateMatch) {
      stateVariables.push({
        name: stateMatch[1],
        line: lineNumber,
        declaration: line,
      });
    }
  });

  return { contracts, functions, stateVariables };
}

async function main() {
  const fileArgument = process.argv
    .slice(2)
    .find((arg) => arg.endsWith(".sol"));

  if (!fileArgument) {
    console.error(
      "Usage: npx hardhat run scripts/analyze.ts -- <path-to-contract.sol>"
    );
    process.exitCode = 1;
    return;
  }

  const filePath = path.resolve(fileArgument);

  let source: string;

  try {
    source = await readFile(filePath, "utf8");
  } catch {
    console.error(`Could not read Solidity file: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const structure = extractItems(source);

  console.log("\n=== Smart Contract Analysis ===");
  console.log(`File: ${filePath}`);

  console.log("\nContracts:");
  console.log(structure.contracts);

  console.log("\nPublic state variables:");
  console.log(structure.stateVariables);

  console.log("\nFunctions:");
  console.log(structure.functions);

  console.log("\nCandidate invariants:");

  const candidates = inferCandidateInvariants(source);
  console.log(JSON.stringify(candidates, null, 2));

  console.log("\n=== Analysis Complete ===");
}

main().catch((error: unknown) => {
  console.error("Analysis failed:", error);
  process.exitCode = 1;
});
