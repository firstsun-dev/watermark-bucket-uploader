import { describe, it, expect } from "vitest";
import { wrapFileDependingOnType, generateFileHash } from "../src/uploader";

describe("wrapFileDependingOnType", () => {
	it("wraps image", () => {
		expect(wrapFileDependingOnType("https://cdn.example.com/a.webp", "image", ""))
			.toBe("![image](https://cdn.example.com/a.webp)");
	});

	it("wraps video", () => {
		expect(wrapFileDependingOnType("https://cdn.example.com/v.mp4", "video", ""))
			.toBe('<video src="https://cdn.example.com/v.mp4" controls />');
	});

	it("wraps audio", () => {
		expect(wrapFileDependingOnType("https://cdn.example.com/a.mp3", "audio", ""))
			.toBe('<audio src="https://cdn.example.com/a.mp3" controls />');
	});

	it("wraps ppt", () => {
		const result = wrapFileDependingOnType("https://cdn.example.com/deck.pptx", "ppt", "");
		expect(result).toContain("officeapps.live.com");
		expect(result).toContain("https://cdn.example.com/deck.pptx");
	});

	it("wraps pdf (no local)", () => {
		const result = wrapFileDependingOnType("https://cdn.example.com/doc.pdf", "pdf", "");
		expect(result).toContain("docs.google.com/viewer");
	});

	it("throws for pdf with localBase", () => {
		expect(() => wrapFileDependingOnType("/local/doc.pdf", "pdf", "/base"))
			.toThrow("PDFs cannot be embedded in local mode");
	});

	it("throws for unknown type", () => {
		expect(() => wrapFileDependingOnType("https://x.com/f.xyz", "xyz", ""))
			.toThrow("Unknown file type");
	});

	it("prepends file:// for local video", () => {
		const result = wrapFileDependingOnType("/path/to/v.mp4", "video", "/base");
		expect(result).toContain("file:///base/");
	});
});

describe("generateFileHash", () => {
	it("returns a 32-char hex string", async () => {
		const data = new Uint8Array([1, 2, 3, 4]);
		const hash = await generateFileHash(data);
		expect(hash).toHaveLength(32);
		expect(hash).toMatch(/^[0-9a-f]+$/);
	});

	it("same input produces same hash", async () => {
		const data = new Uint8Array([10, 20, 30]);
		expect(await generateFileHash(data)).toBe(await generateFileHash(data));
	});

	it("different input produces different hash", async () => {
		const a = await generateFileHash(new Uint8Array([1]));
		const b = await generateFileHash(new Uint8Array([2]));
		expect(a).not.toBe(b);
	});
});
