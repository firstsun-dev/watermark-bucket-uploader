import { describe, it, expect } from "vitest";
import { wrapFileDependingOnType, formatTimestamp, resolveFolder } from "../src/uploader";

describe("resolveFolder", () => {
	it("replaces placeholders", () => {
		const now = new Date("2026-04-26T12:00:00");
		const result = resolveFolder("blog/${year}/${month}/${day}/${basename}", "My Note", now);
		expect(result).toBe("blog/2026/04/26/My-Note");
	});

	it("handles missing placeholders", () => {
		const result = resolveFolder("static", "note", new Date());
		expect(result).toBe("static");
	});
});

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
		expect(result).toContain(encodeURIComponent("https://cdn.example.com/deck.pptx"));
	});

	it("wraps pdf (no local)", () => {
		const result = wrapFileDependingOnType("https://cdn.example.com/doc.pdf", "pdf", "");
		expect(result).toContain("docs.google.com/viewer");
		expect(result).toContain(encodeURIComponent("https://cdn.example.com/doc.pdf"));
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

describe("formatTimestamp", () => {
	it("returns a 14-char numeric string", () => {
		const ts = formatTimestamp(new Date("2026-03-31T15:45:23"));
		expect(ts).toHaveLength(14);
		expect(ts).toMatch(/^\d{14}$/);
	});

	it("formats date correctly", () => {
		const ts = formatTimestamp(new Date("2026-03-31T09:05:03"));
		expect(ts).toBe("20260331090503");
	});
});
