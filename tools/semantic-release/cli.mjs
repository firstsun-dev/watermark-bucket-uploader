#!/usr/bin/env node
import { parseOptions } from "./options.mjs";

let runningRelease = false;
try {
  const { help, version, options } = parseOptions(process.argv.slice(2));
  if (help) {
    console.log(`Usage: semantic-release [options]

Project-local adapter for @semantic-release/core 1.0.0-beta.1.

  -d, --dry-run               Analyze without publishing
      --ci / --no-ci          Enable or bypass CI policy checks
  -b, --branches <names>      Comma-separated release branches (repeatable)
  -r, --repository-url <url>  Git repository URL
  -t, --tag-format <format>   Release tag format
  -p, --plugins <names>       Comma-separated plugins (repeatable)
  -e, --extends <names>       Shared configuration (repeatable)
  -h, --help                 Show this help
  -v, --version              Show adapter and core versions`);
  } else if (version) {
    console.log("semantic-release project adapter 25.0.0; @semantic-release/core 1.0.0-beta.1");
  } else {
    const { default: semanticRelease } = await import("./index.mjs");
    runningRelease = true;
    await semanticRelease(options);
  }
} catch (error) {
  // Core reports release errors itself; avoid printing token-bearing error objects.
  console.error(runningRelease ? "Release failed; see output above." : error.message);
  process.exitCode = 1;
}
