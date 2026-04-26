import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressImage } from "../src/imageProcessor";
import { R2UploaderSettings } from "../src/settings";

vi.mock("browser-image-compression", () => ({
	default: vi.fn().mockImplementation((file) => Promise.resolve(file)),
}));

vi.mock("obsidian", () => ({
	Notice: vi.fn(),
}));

const base: R2UploaderSettings = {
	accessKey: "", secretKey: "", region: "", bucket: "", folder: "",
	imageUrlPath: "", uploadOnDrag: true, localUpload: false, localUploadFolder: "",
	useCustomEndpoint: false, customEndpoint: "", forcePathStyle: false,
	useCustomImageUrl: false, customImageUrl: "", uploadVideo: false,
	uploadAudio: false, uploadPdf: false, bypassCors: false,
	queryStringValue: "", queryStringKey: "", enableImageCompression: true,
	maxImageCompressionSize: 1, imageCompressionQuality: 0.7, maxImageWidthOrHeight: 4096,
	ignorePattern: "", disableAutoUploadOnCreate: false,
	convertToWebP: true, webpQuality: 0.85,
	watermarkEnabled: false, watermarkText: "",
	watermarkFont: "", watermarkFontFamily: "", watermarkFontSize: 0,
	watermarkBold: false, watermarkItalic: false,
	watermarkColor: "", watermarkPosition: "center",
	watermarkOffsetX: 0, watermarkOffsetY: 0,
	watermarkLogoEnabled: false, watermarkLogoPath: "", watermarkLogoSize: 0,
	watermarkLogoOpacity: 0, watermarkLogoPosition: "center",
	watermarkLogoOffsetX: 0, watermarkLogoOffsetY: 0,
	previewBackground: "black", previewBackgroundColor: "",
	previewResolution: "720p", previewResolutionCustom: "",
	debugMode: false, uploadSeq: 0,
};

describe("compressImage", () => {
	it("compresses image", async () => {
		const file = new File(["test"], "test.png", { type: "image/png" });
		const log = vi.fn();
		const result = await compressImage(file, base, log);
		expect(result).toBeDefined();
		expect(log).toHaveBeenCalled();
	});
});
