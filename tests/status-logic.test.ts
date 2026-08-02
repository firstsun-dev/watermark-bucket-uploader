import { describe, it, expect } from "vitest";
import { computeRows, computeSummary, buildStatusLine, STATE_CLASS } from "../src/settings/status-logic";
import { DEFAULT_SETTINGS, type R2UploaderSettings } from "../src/settings/types";

function settings(overrides: Partial<R2UploaderSettings> = {}): R2UploaderSettings {
	return { ...DEFAULT_SETTINGS, ...overrides };
}

describe("computeRows — local upload destination", () => {
	it("skips S3 credential/bucket checks and marks destination good", () => {
		const s = settings({ localUpload: true, localUploadFolder: "attachments" });
		const rows = computeRows(s);
		expect(rows).toHaveLength(4);
		expect(rows[0]).toMatchObject({ label: "Upload destination", state: "good" });
		expect(rows[1]).toMatchObject({ label: "Local folder", state: "good" });
		// No row references access/secret/bucket connection.
		expect(rows.some((r) => r.label.includes("credentials"))).toBe(false);
		expect(rows.some((r) => r.label.includes("Bucket connection"))).toBe(false);
	});

	it("flags a missing local folder as attention", () => {
		const s = settings({ localUpload: true, localUploadFolder: "" });
		const rows = computeRows(s);
		expect(rows[1]).toMatchObject({ label: "Local folder", state: "attention" });
		expect(rows[1].detail).toBe("No folder chosen");
	});
});

describe("computeRows — bucket upload destination", () => {
	it("reports missing credentials as attention", () => {
		const s = settings({ localUpload: false, accessKey: "", secretKey: "" });
		const rows = computeRows(s);
		expect(rows[0]).toMatchObject({ label: "Storage credentials configured", state: "attention" });
	});

	it("treats an untested bucket as attention (not failed)", () => {
		const s = settings({
			localUpload: false,
			accessKey: "a",
			secretKey: "b",
			lastConnectionTestSuccess: undefined,
		});
		const rows = computeRows(s);
		expect(rows[1]).toMatchObject({ state: "attention" });
		expect(rows[1].detail).toBe("Not tested yet");
	});

	it("marks bucket verified after a passing test with no pending retest", () => {
		const s = settings({
			localUpload: false,
			accessKey: "a",
			secretKey: "b",
			lastConnectionTestSuccess: true,
			connectionNeedsRetest: false,
		});
		expect(computeRows(s)[1]).toMatchObject({ state: "good", detail: "Verified" });
	});

	it("marks bucket as needing retest when settings changed after a pass", () => {
		const s = settings({
			localUpload: false,
			accessKey: "a",
			secretKey: "b",
			lastConnectionTestSuccess: true,
			connectionNeedsRetest: true,
		});
		const row = computeRows(s)[1];
		expect(row.state).toBe("attention");
		expect(row.detail).toContain("retest");
	});

	it("derives a public URL from region + bucket when no custom endpoint", () => {
		const s = settings({
			localUpload: false,
			region: "auto",
			bucket: "my-bucket",
			useCustomEndpoint: false,
			useCustomImageUrl: false,
		});
		expect(computeRows(s)[2]).toMatchObject({ state: "good", detail: "URL can be derived" });
	});

	it("does not derive a URL for custom-endpoint providers without a custom URL", () => {
		const s = settings({
			localUpload: false,
			storageProvider: "minio",
			region: "",
			bucket: "my-bucket",
			useCustomEndpoint: true,
			useCustomImageUrl: false,
		});
		expect(computeRows(s)[2]).toMatchObject({ state: "neutral" });
	});

	it("treats an explicit custom image URL as configured", () => {
		const s = settings({
			localUpload: false,
			useCustomImageUrl: true,
			customImageUrl: "https://cdn.example.com/",
		});
		expect(computeRows(s)[2]).toMatchObject({ state: "good" });
	});
});

describe("watermark row", () => {
	it("is neutral when watermark is disabled", () => {
		const s = settings({ watermarkEnabled: false, watermarkLogoEnabled: false });
		expect(computeRows(s)[3]).toMatchObject({ state: "neutral", detail: "Disabled" });
	});

	it("is good when text watermark is enabled with non-empty text", () => {
		const s = settings({ watermarkEnabled: true, watermarkText: "© me" });
		expect(computeRows(s)[3]).toMatchObject({ state: "good", detail: "Configured" });
	});

	it("is attention when text watermark is enabled but text is empty", () => {
		const s = settings({ watermarkEnabled: true, watermarkText: "   " });
		expect(computeRows(s)[3]).toMatchObject({ state: "attention" });
		expect(computeRows(s)[3].detail).toBe("Watermark text is empty");
	});

	it("is attention when logo watermark is enabled but no logo path is set", () => {
		const s = settings({ watermarkLogoEnabled: true, watermarkLogoPath: "" });
		expect(computeRows(s)[3]).toMatchObject({ state: "attention" });
		expect(computeRows(s)[3].detail).toBe("Logo enabled but no logo selected");
	});

	it("is good when both enabled layers are ready", () => {
		const s = settings({
			watermarkEnabled: true,
			watermarkText: "© me",
			watermarkLogoEnabled: true,
			watermarkLogoPath: "logo.png",
		});
		expect(computeRows(s)[3]).toMatchObject({ state: "good" });
	});
});

describe("computeSummary", () => {
	it("local upload with a folder is ready", () => {
		const s = settings({ localUpload: true, localUploadFolder: "attachments" });
		expect(computeSummary(s)).toMatchObject({ text: "Ready to upload", state: "good" });
	});

	it("local upload without a folder needs attention", () => {
		const s = settings({ localUpload: true, localUploadFolder: "" });
		expect(computeSummary(s)).toMatchObject({ text: "Needs attention", state: "attention" });
	});

	it("bucket upload with no credentials is not configured (neutral)", () => {
		const s = settings({ localUpload: false, accessKey: "", secretKey: "" });
		expect(computeSummary(s)).toMatchObject({ text: "Not configured", state: "neutral" });
	});

	it("bucket upload with credentials + verified bucket is ready", () => {
		const s = settings({
			localUpload: false,
			accessKey: "a",
			secretKey: "b",
			lastConnectionTestSuccess: true,
			connectionNeedsRetest: false,
		});
		expect(computeSummary(s)).toMatchObject({ text: "Ready to upload", state: "good" });
	});

	it("bucket upload with credentials but untested bucket needs attention", () => {
		const s = settings({
			localUpload: false,
			accessKey: "a",
			secretKey: "b",
			lastConnectionTestSuccess: undefined,
		});
		expect(computeSummary(s)).toMatchObject({ text: "Needs attention", state: "attention" });
	});
});

describe("buildStatusLine", () => {
	it("joins destination · connection · watermark segments", () => {
		const s = settings({
			localUpload: true,
			localUploadFolder: "attachments",
			watermarkEnabled: true,
			watermarkText: "© me",
		});
		const line = buildStatusLine(s);
		expect(line.segments).toEqual(["Local uploads", "folder ready", "watermark on"]);
		expect(line.state).toBe("good");
		expect(line.issues).toEqual([]);
	});

	it("reports 'credentials missing' when bucket uploads lack keys", () => {
		const s = settings({ localUpload: false, accessKey: "", secretKey: "" });
		const line = buildStatusLine(s);
		expect(line.segments[0]).toBe("Bucket uploads");
		expect(line.segments[1]).toBe("credentials missing");
		expect(line.issues).toContain("Access key and/or secret key missing");
	});

	it("reports 'needs retest' after a settings change post-pass", () => {
		const s = settings({
			localUpload: false,
			accessKey: "a",
			secretKey: "b",
			lastConnectionTestSuccess: true,
			connectionNeedsRetest: true,
		});
		expect(buildStatusLine(s).segments[1]).toBe("needs retest");
	});

	it("reports 'connection failed' after a failing test", () => {
		const s = settings({
			localUpload: false,
			accessKey: "a",
			secretKey: "b",
			lastConnectionTestSuccess: false,
			connectionNeedsRetest: false,
		});
		expect(buildStatusLine(s).segments[1]).toBe("connection failed");
	});

	it("reports 'watermark off' segment when no watermark layer is enabled", () => {
		const s = settings({ localUpload: true, localUploadFolder: "attachments" });
		expect(buildStatusLine(s).segments[2]).toBe("watermark off");
	});

	it("reports 'watermark incomplete' and surfaces the issue", () => {
		const s = settings({
			localUpload: true,
			localUploadFolder: "attachments",
			watermarkEnabled: true,
			watermarkText: "",
		});
		const line = buildStatusLine(s);
		expect(line.segments[2]).toBe("watermark incomplete");
		expect(line.issues).toContain("Watermark text is empty");
	});
});

describe("STATE_CLASS mapping", () => {
	it("maps each row state to a distinct CSS modifier", () => {
		expect(STATE_CLASS.good).toBe("r2-status-success");
		expect(STATE_CLASS.attention).toBe("r2-status-warning");
		expect(STATE_CLASS.neutral).toBe("r2-status-muted");
	});
});