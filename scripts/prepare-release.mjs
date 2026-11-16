import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import semver from "semver";

/** Synchronize Obsidian and package metadata without installing the npm release plugin. */
export async function prepareRelease(version, cwd = process.cwd()) {
  if (!version || semver.valid(version) !== version) throw new Error("Invalid release version.");
  // pnpm locks dependency resolution, not the root package version. Keep it byte-for-byte.
  await readFile(resolve(cwd, "pnpm-lock.yaml"), "utf8");
  const names = ["package.json", "manifest.json", "versions.json"];
  // Read and validate everything before writing so malformed input cannot partially bump versions.
  const documents = await Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(cwd, name), "utf8"))));
  const [pkg, manifest, versions] = documents;
  if (typeof manifest.minAppVersion !== "string") {
    throw new Error("Missing release metadata in manifest.json.");
  }
  pkg.version = manifest.version = version;
  versions[version] = manifest.minAppVersion;
  for (let index = 0; index < names.length; index++) {
    await writeFile(resolve(cwd, names[index]), JSON.stringify(documents[index], null, index === 0 ? 2 : "\t") + "\n");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await prepareRelease(process.argv[2]);
}
