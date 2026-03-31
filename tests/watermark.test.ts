import { describe, it, expect } from "vitest";
import { buildFont, resolvePosition } from "../src/watermark";
import type { R2UploaderSettings } from "../src/settings";

const base: R2UploaderSettings = {
	accessKey: "", secretKey: "", region: "", bucket: "", folder: "",
	imageUrlPath: "", uploadOnDrag: true, localUpload: false, localUploadFolder: "",
	useCustomEndpoint: false, customEndpoint: "", forcePathStyle: false,
	useCustomImageUrl: false, customImageUrl: "", uploadVideo: false,
	uploadAudio: false, uploadPdf: false, bypassCors: false,
	queryStringValue: "", queryStringKey: "", enableImageCompression: false,
	maxImageCompressionSize: 1, imageCompressionQuality: 0.7, maxImageWidthOrHeight: 4096,
	ignorePattern: "", disableAutoUploadOnCreate: false,
	convertToWebP: true, webpQuality: 0.85,
	watermarkEnabled: true, watermarkText: "© test",
	watermarkFont: "16px Arial", watermarkFontFamily: "Arial", watermarkFontSize: 0,
	watermarkBold: false, watermarkItalic: false,
	watermarkColor: "rgba(255,255,255,0.85)", watermarkPosition: "bottom-right",
	watermarkOffsetX: 0, watermarkOffsetY: 0,
	watermarkLogoEnabled: false, watermarkLogoPath: "", watermarkLogoSize: 15,
	watermarkLogoOpacity: 0.5, watermarkLogoPosition: "bottom-right",
	watermarkLogoOffsetX: 0, watermarkLogoOffsetY: 0,
	previewBackground: "checker", previewBackgroundColor: "#888888", debugMode: false,
	uploadSeq: 0,
};

describe("buildFont", () => {
	it("uses auto size when fontSize is 0", () => {
		const font = buildFont({ ...base, watermarkFontSize: 0 }, 1000);
		expect(font).toMatch(/^\d+px Arial$/);
	});

	it("uses explicit fontSize when set", () => {
		const font = buildFont({ ...base, watermarkFontSize: 48 }, 1000);
		expect(font).toContain("48px");
	});

	it("prepends bold", () => {
		const font = buildFont({ ...base, watermarkBold: true, watermarkFontSize: 20 }, 1000);
		expect(font).toMatch(/^bold /);
	});

	it("prepends italic", () => {
		const font = buildFont({ ...base, watermarkItalic: true, watermarkFontSize: 20 }, 1000);
		expect(font).toMatch(/^italic /);
	});

	it("prepends bold italic", () => {
		const font = buildFont({ ...base, watermarkBold: true, watermarkItalic: true, watermarkFontSize: 20 }, 1000);
		expect(font).toMatch(/^bold italic /);
	});

	it("uses custom font family", () => {
		const font = buildFont({ ...base, watermarkFontFamily: "Georgia", watermarkFontSize: 20 }, 1000);
		expect(font).toContain("Georgia");
	});
});

describe("resolvePosition", () => {
	const W = 1000, H = 500, eW = 100, eH = 20, pad = 10;

	it("bottom-right", () => {
		const { x, y } = resolvePosition("bottom-right", W, H, eW, eH, pad);
		expect(x).toBe(W - eW - pad);
		expect(y).toBe(H - pad);
	});

	it("bottom-left", () => {
		const { x, y } = resolvePosition("bottom-left", W, H, eW, eH, pad);
		expect(x).toBe(pad);
		expect(y).toBe(H - pad);
	});

	it("bottom-center", () => {
		const { x, y } = resolvePosition("bottom-center", W, H, eW, eH, pad);
		expect(x).toBe(Math.round((W - eW) / 2));
		expect(y).toBe(H - pad);
	});

	it("center", () => {
		const { x, y } = resolvePosition("center", W, H, eW, eH, pad);
		expect(x).toBe(Math.round((W - eW) / 2));
		expect(y).toBe(Math.round((H + eH) / 2));
	});

	it("applies offsetX and offsetY", () => {
		const { x, y } = resolvePosition("bottom-right", W, H, eW, eH, pad, 10, 5);
		expect(x).toBe(W - eW - pad + Math.round(W * 10 / 100));
		expect(y).toBe(H - pad + Math.round(H * 5 / 100));
	});
});
