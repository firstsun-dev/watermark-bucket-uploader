import { describe, it, expect, vi } from "vitest";
import { detectFileType } from "../src/pasteHandler";

describe("detectFileType", () => {
	it("detects image", () => {
		const file = { type: "image/png" } as File;
		expect(detectFileType(file, { uploadVideo: true, uploadAudio: true, uploadPdf: true })).toBe("image");
	});

	it("detects video", () => {
		const file = { type: "video/mp4" } as File;
		expect(detectFileType(file, { uploadVideo: true, uploadAudio: true, uploadPdf: true })).toBe("video");
	});

	it("detects audio", () => {
		const file = { type: "audio/mpeg" } as File;
		expect(detectFileType(file, { uploadVideo: true, uploadAudio: true, uploadPdf: true })).toBe("audio");
	});

	it("detects pdf", () => {
		const file = { type: "application/pdf" } as File;
		expect(detectFileType(file, { uploadVideo: true, uploadAudio: true, uploadPdf: true })).toBe("pdf");
	});

	it("returns empty for unknown", () => {
		const file = { type: "text/plain" } as File;
		expect(detectFileType(file, { uploadVideo: true, uploadAudio: true, uploadPdf: true })).toBe("");
	});
});
