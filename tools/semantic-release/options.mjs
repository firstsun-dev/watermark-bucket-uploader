import { parseArgs } from "node:util";

const listOptions = ["branches", "plugins", "extends"];

/** Parse only known flags so a misspelled dry-run cannot publish a release. */
export function parseOptions(args) {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      "dry-run": { type: "boolean", short: "d" },
      ci: { type: "boolean" },
      "no-ci": { type: "boolean" },
      branches: { type: "string", short: "b", multiple: true },
      "repository-url": { type: "string", short: "r" },
      "tag-format": { type: "string", short: "t" },
      plugins: { type: "string", short: "p", multiple: true },
      extends: { type: "string", short: "e", multiple: true },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.ci && values["no-ci"]) throw new Error("Use either --ci or --no-ci.");
  const options = {};
  for (const [name, value] of Object.entries(values)) {
    if (["help", "version", "no-ci"].includes(name)) continue;
    const key = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[key] = listOptions.includes(name)
      ? value.flatMap((item) => item.split(",").map((part) => part.trim())).filter(Boolean)
      : value;
  }
  if (values["no-ci"]) options.ci = false;
  return { help: !!values.help, version: !!values.version, options };
}
