#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import {
  ENV_FILE,
  readApiKey,
  runValidation,
  serializeReport,
} from "./lib.mjs";

function outputPathFromArgs(args) {
  const index = args.indexOf("--output");
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error("--output requires a file path");
  return value;
}

export async function main({
  args = process.argv.slice(2),
  envFile = ENV_FILE,
  reader,
  stdout = process.stdout,
  writer = writeFile,
  fetchImpl = globalThis.fetch,
} = {}) {
  let outputPath;
  try {
    outputPath = outputPathFromArgs(args);
  } catch (error) {
    stdout.write(`${JSON.stringify({ schemaVersion: "massive-free-tier-validation/v1", status: "refused", reason: "invalid_arguments", error: error.message })}\n`);
    return 2;
  }

  const keyResult = await readApiKey(envFile, reader);
  if (!keyResult.ok) {
    stdout.write(`${JSON.stringify({
      schemaVersion: "massive-free-tier-validation/v1",
      status: "refused",
      reason: keyResult.reason,
      environmentFile: "~/.config/massive.env",
      liveRequestsMade: 0,
    })}\n`);
    return 2;
  }

  const report = await runValidation({ apiKey: keyResult.apiKey, fetchImpl });
  const serialized = `${serializeReport(report, keyResult.apiKey)}\n`;
  if (outputPath) await writer(outputPath, serialized, { mode: 0o600 });
  stdout.write(serialized);
  return report.summary.allReferenceIdentitiesPass && report.summary.allCoveragePass && report.summary.allDataQualityPass ? 0 : 1;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  process.exitCode = await main();
}
