import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseOptions } from "../tools/semantic-release/options.mjs";
import { applyCiPolicy } from "../tools/semantic-release/policy.mjs";
import { prepareRelease } from "../scripts/prepare-release.mjs";

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("release CLI", () => {
	it("preserves dry-run and no-ci options", () => {
		expect(parseOptions(["--dry-run", "--no-ci", "--branches", "main,beta"]).options)
			.toEqual({ dryRun: true, ci: false, branches: ["main", "beta"] });
		expect(parseOptions(["-d"]).options).toEqual({ dryRun: true });
	});

	it("rejects misspelled flags and unexpected arguments before running a release", () => {
		expect(() => parseOptions(["--dryrun"])).toThrow();
		expect(() => parseOptions(["--dry-run=false"])).toThrow();
		expect(() => parseOptions(["publish"])).toThrow();
	});

	it("defaults local execution to dry-run and skips pull requests", () => {
		expect(applyCiPolicy({}, { isCi: false })).toEqual({ options: { dryRun: true }, skip: false });
		expect(applyCiPolicy({}, { isCi: true, isPr: true }).skip).toBe(true);
		expect(applyCiPolicy({ ci: false }, { isCi: false })).toEqual({ options: { ci: false }, skip: false });
		expect(applyCiPolicy({ dryRun: true }, { isCi: true })).toEqual({ options: { dryRun: true }, skip: false });
	});
});

describe("release version preparation", () => {
	async function fixture() {
		const cwd = await mkdtemp(join(tmpdir(), "watermark-release-"));
		directories.push(cwd);
		const files = {
			"package.json": { name: "watermark-bucket-uploader", version: "0.0.0", scripts: { build: "keep" } },
			"pnpm-lock.yaml": "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      example:\n        specifier: ^1.0.0\n        version: 1.2.3\n",
			"manifest.json": { id: "watermark-bucket-uploader", version: "0.0.0", minAppVersion: "1.5.0" },
			"versions.json": { "0.0.0": "1.4.0" },
		};
		await Promise.all(Object.entries(files).map(([name, value]) => writeFile(join(cwd, name), typeof value === "string" ? value : JSON.stringify(value))));
		return { cwd, files };
	}

	it("synchronizes release metadata without changing dependency records", async () => {
		const { cwd, files } = await fixture();
		await prepareRelease("1.2.3", cwd);
		const read = async (name: string) => JSON.parse(await readFile(join(cwd, name), "utf8"));
		expect(await read("package.json")).toEqual({ ...files["package.json"], version: "1.2.3" });
		expect(await readFile(join(cwd, "pnpm-lock.yaml"), "utf8")).toBe(files["pnpm-lock.yaml"]);
		expect(await read("manifest.json")).toEqual({ ...files["manifest.json"], version: "1.2.3" });
		expect(await read("versions.json")).toEqual({ "0.0.0": "1.4.0", "1.2.3": "1.5.0" });
		await prepareRelease("1.2.3", cwd);
		expect(await read("versions.json")).toEqual({ "0.0.0": "1.4.0", "1.2.3": "1.5.0" });
	});

	it("rejects invalid versions before writing any files", async () => {
		const { cwd, files } = await fixture();
		for (const version of ["", "v1.2.3", "1.2", "1.2.3; touch bad"]) {
			await expect(prepareRelease(version, cwd)).rejects.toThrow("version");
		}
		for (const [name, value] of Object.entries(files)) {
			expect(await readFile(join(cwd, name), "utf8")).toBe(typeof value === "string" ? value : JSON.stringify(value));
		}
	});

	it("validates all input files before changing version metadata", async () => {
		const { cwd, files } = await fixture();
		await writeFile(join(cwd, "versions.json"), "invalid JSON");
		await expect(prepareRelease("1.2.3", cwd)).rejects.toThrow();
		expect(await readFile(join(cwd, "package.json"), "utf8")).toBe(JSON.stringify(files["package.json"]));
	});
});

describe("core integration", () => {
	it("skips GitHub pull requests before loading plugins or contacting the remote", async () => {
		const { Writable } = await import("node:stream");
		const { default: release } = await import("../tools/semantic-release/index.mjs");
		const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
		const result = await release({ plugins: ["does-not-exist"], repositoryUrl: "https://invalid.example/repo.git" }, {
			cwd: process.cwd(), stdout: output, stderr: output,
			env: { PATH: process.env.PATH, GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/1/merge" },
		});
		expect(result).toBe(false);
	});

	it("loads every production plugin and retains the release assets", async () => {
		const { execFileSync } = await import("node:child_process");
		const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
			import { getLogger, resolveConfig, resolveEnvCi } from '@semantic-release/core';
			const context = { cwd: process.cwd(), env: process.env, stdout: process.stdout, stderr: process.stderr };
			context.logger = getLogger(context);
			context.envCi = resolveEnvCi(context);
			await resolveConfig(context, { dryRun: true }, { buildPlugins: true });
		`], { cwd: process.cwd(), encoding: "utf8" });
		expect(output).toContain('Loaded plugin "publish" from "@semantic-release/github"');
		const configuration = JSON.parse(await readFile(new URL("../.releaserc.json", import.meta.url), "utf8"));
		const plugins = new Map<string, { assets: (string | { path: string })[]; prepareCmd: string }>(configuration.plugins);
		expect(plugins.has("@semantic-release/npm")).toBe(false);
		expect(plugins.get("@semantic-release/git")?.assets).toContain("pnpm-lock.yaml");
		expect(plugins.get("@semantic-release/github")).toEqual({});
		expect(plugins.get("@semantic-release/exec")).not.toHaveProperty("publishCmd");
		expect(plugins.get("@semantic-release/exec")?.prepareCmd).toBe("node scripts/prepare-release.mjs ${nextRelease.version}");
	});

	it.each([false, true])("analyzes offline without publishing (shared configuration: %s)", async (shared) => {
		const { execFileSync } = await import("node:child_process");
		const { mkdir } = await import("node:fs/promises");
		const { Writable } = await import("node:stream");
		const { default: release } = await import("../tools/semantic-release/index.mjs");
		const directory = await mkdtemp(join(tmpdir(), "watermark-release-integration-"));
		directories.push(directory);
		const cwd = join(directory, "checkout");
		const remote = join(directory, "remote.git");
		await mkdir(cwd);
		const git = (...args: string[]) => execFileSync("git", args, { cwd, stdio: "pipe" }).toString().trim();
		git("init", "-b", "main");
		git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "fix: offline fixture");
		git("clone", "--bare", cwd, remote);
		const head = git("rev-parse", "HEAD");
		const sharedDirectory = join(directory, "shared");
		const pluginDirectory = join(sharedDirectory, "node_modules", "private-release-plugin");
		await mkdir(pluginDirectory, { recursive: true });
		await writeFile(join(pluginDirectory, "index.js"), "exports.analyzeCommits = () => 'patch'; exports.generateNotes = () => 'Offline release test'; exports.prepare = () => { throw new Error('must not prepare in dry run'); }; exports.publish = () => { throw new Error('must not publish in dry run'); };");
		await writeFile(join(sharedDirectory, "index.cjs"), "module.exports = { plugins: ['private-release-plugin'] };");
		let preparations = 0;
		let publications = 0;
		const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
		const result = await release({
			branches: ["main"], repositoryUrl: remote,
			...(shared ? { extends: join(sharedDirectory, "index.cjs") } : { plugins: [{
				analyzeCommits: () => "patch",
				generateNotes: () => "Offline release test",
				prepare: () => { preparations++; },
				publish: () => { publications++; },
			}] }),
		}, { cwd, env: { PATH: process.env.PATH }, stdout: output, stderr: output });
		expect(result && result.nextRelease.version).toBe("1.0.0");
		expect(preparations).toBe(0);
		expect(publications).toBe(0);
		expect(git("tag", "--list")).toBe("");
		expect(git("rev-parse", "HEAD")).toBe(head);
		expect(git("--git-dir", remote, "tag", "--list")).toBe("");
	}, 15000);
});
