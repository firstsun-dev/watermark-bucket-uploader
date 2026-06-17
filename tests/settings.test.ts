import { describe, it, expect } from "vitest";
import { normalizeUrl, isValidUrl, isValidResolution } from "../src/settings";

describe("normalizeUrl", () => {
	it("adds https:// scheme when missing", () => {
		expect(normalizeUrl("example.com")).toBe("https://example.com/");
	});

	it("keeps an existing http:// or https:// scheme", () => {
		expect(normalizeUrl("http://example.com")).toBe("http://example.com/");
		expect(normalizeUrl("https://example.com")).toBe("https://example.com/");
	});

	it("appends a trailing slash when missing", () => {
		expect(normalizeUrl("https://example.com/path")).toBe("https://example.com/path/");
	});

	it("leaves an existing trailing slash as-is", () => {
		expect(normalizeUrl("https://example.com/path/")).toBe("https://example.com/path/");
	});

	it("trims surrounding whitespace", () => {
		expect(normalizeUrl("  example.com  ")).toBe("https://example.com/");
	});
});

describe("isValidUrl", () => {
	it("accepts well-formed URLs", () => {
		expect(isValidUrl("https://example.com/")).toBe(true);
		expect(isValidUrl("http://sub.example.com/path/")).toBe(true);
	});

	it("rejects malformed URLs", () => {
		expect(isValidUrl("not a url")).toBe(false);
		expect(isValidUrl("")).toBe(false);
		expect(isValidUrl("https://")).toBe(false);
	});
});

describe("isValidResolution", () => {
	it("accepts WIDTHxHEIGHT in various separator styles", () => {
		expect(isValidResolution("1920x1080")).toBe(true);
		expect(isValidResolution("1920X1080")).toBe(true);
		expect(isValidResolution("1920×1080")).toBe(true);
		expect(isValidResolution("1920, 1080")).toBe(true);
		expect(isValidResolution("1920 1080")).toBe(true);
	});

	it("rejects non-positive or non-numeric dimensions", () => {
		expect(isValidResolution("0x1080")).toBe(false);
		expect(isValidResolution("1920x-1080")).toBe(false);
		expect(isValidResolution("abcxdef")).toBe(false);
	});

	it("rejects values that aren't exactly two dimensions", () => {
		expect(isValidResolution("1920")).toBe(false);
		expect(isValidResolution("1920x1080x60")).toBe(false);
		expect(isValidResolution("")).toBe(false);
	});
});
