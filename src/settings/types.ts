export interface PasteFunction {
	(
		this: HTMLElement,
		event: ClipboardEvent | DragEvent,
		editor: import("obsidian").Editor,
	): void;
}

export type WatermarkPosition =
	| "top-left"
	| "top-center"
	| "top-right"
	| "center-left"
	| "center"
	| "center-right"
	| "bottom-left"
	| "bottom-center"
	| "bottom-right";

export type StorageProvider = "r2" | "s3" | "minio" | "b2" | "custom";

export type WatermarkPresetId = "minimal-corner" | "blog-signature" | "center-protected" | "logo-only" | "custom";

export type SampleImageId = "light" | "dark" | "checker" | "vault";

export interface R2UploaderSettings {
	// Storage provider
	storageProvider: StorageProvider;
	accessKey: string;
	secretKey: string;
	region: string;
	bucket: string;
	folder: string;
	imageUrlPath: string;
	uploadOnDrag: boolean;
	uploadPastedImages: boolean;
	uploadOnCreate: boolean;
	localUpload: boolean;
	localUploadFolder: string;
	useCustomEndpoint: boolean;
	customEndpoint: string;
	forcePathStyle: boolean;
	useCustomImageUrl: boolean;
	customImageUrl: string;
	uploadVideo: boolean;
	uploadAudio: boolean;
	uploadPdf: boolean;
	bypassCors: boolean;
	queryStringValue: string;
	queryStringKey: string;
	enableImageCompression: boolean;
	maxImageCompressionSize: number;
	imageCompressionQuality: number;
	maxImageWidthOrHeight: number;
	ignorePattern: string;
	/** @deprecated use uploadOnCreate (inverted) — kept only for migrating existing data.json files */
	disableAutoUploadOnCreate?: boolean;
	// WebP conversion
	convertToWebP: boolean;
	webpQuality: number;
	// Watermark — text
	watermarkEnabled: boolean;
	watermarkText: string;
	watermarkFont: string;
	watermarkFontFamily: string;
	watermarkFontSize: number;
	watermarkBold: boolean;
	watermarkItalic: boolean;
	watermarkColor: string;
	watermarkPosition: WatermarkPosition;
	watermarkOffsetX: number;
	watermarkOffsetY: number;
	// Watermark — logo image
	watermarkLogoEnabled: boolean;
	watermarkLogoPath: string;
	watermarkLogoSize: number;
	watermarkLogoOpacity: number;
	watermarkLogoPosition: WatermarkPosition;
	watermarkLogoOffsetX: number;
	watermarkLogoOffsetY: number;
	// Watermark preset
	watermarkPreset: WatermarkPresetId;
	// Preview sample image
	previewSampleImage: SampleImageId;
	previewSampleImagePath: string;
	// Preview background
	previewBackground: "checker" | "white" | "black" | "custom";
	previewBackgroundColor: string;
	// Preview resolution
	previewResolution: "720p" | "1080p" | "4k" | "custom";
	previewResolutionCustom: string;
	// Connection test state (persisted so it survives settings tab re-opens)
	lastConnectionTestSuccess?: boolean;
	lastConnectionTestAt?: number;
	lastConnectionTestBucket?: string;
	lastConnectionTestLatencyMs?: number;
	lastConnectionTestMessage?: string;
	connectionNeedsRetest: boolean;
	// Debug
	debugMode: boolean;
	// Upload sequence counter
	uploadSeq: number;
}

export const DEFAULT_SETTINGS: R2UploaderSettings = {
	storageProvider: "r2",
	accessKey: "",
	secretKey: "",
	region: "",
	bucket: "",
	folder: "",
	imageUrlPath: "",
	uploadOnDrag: true,
	uploadPastedImages: true,
	uploadOnCreate: false,
	localUpload: false,
	localUploadFolder: "",
	useCustomEndpoint: false,
	customEndpoint: "",
	forcePathStyle: false,
	useCustomImageUrl: false,
	customImageUrl: "",
	uploadVideo: false,
	uploadAudio: false,
	uploadPdf: false,
	bypassCors: false,
	queryStringValue: "",
	queryStringKey: "",
	enableImageCompression: false,
	maxImageCompressionSize: 1,
	imageCompressionQuality: 0.7,
	maxImageWidthOrHeight: 4096,
	ignorePattern: "",
	convertToWebP: true,
	webpQuality: 0.85,
	watermarkEnabled: false,
	watermarkText: "© firstsun.org",
	watermarkFont: "16px Arial",
	watermarkFontFamily: "Arial",
	watermarkFontSize: 0,
	watermarkBold: false,
	watermarkItalic: false,
	watermarkColor: "rgba(255, 255, 255, 0.85)",
	watermarkPosition: "bottom-right",
	watermarkOffsetX: 0,
	watermarkOffsetY: 0,
	watermarkLogoEnabled: false,
	watermarkLogoPath: "",
	watermarkLogoSize: 15,
	watermarkLogoOpacity: 0.5,
	watermarkLogoPosition: "bottom-right",
	watermarkLogoOffsetX: 0,
	watermarkLogoOffsetY: 0,
	watermarkPreset: "custom",
	previewSampleImage: "checker",
	previewSampleImagePath: "",
	previewBackground: "checker",
	previewBackgroundColor: "#888888",
	previewResolution: "1080p",
	previewResolutionCustom: "1920x1080",
	connectionNeedsRetest: false,
	debugMode: false,
	uploadSeq: 0,
};

/** Migrates legacy data.json shapes to the current settings shape. Mutates and returns the same object. */
export function migrateSettings(settings: R2UploaderSettings): R2UploaderSettings {
	const raw = settings as unknown as Record<string, unknown>;
	if (typeof raw.disableAutoUploadOnCreate === "boolean") {
		settings.uploadOnCreate = !raw.disableAutoUploadOnCreate;
	}
	delete raw.disableAutoUploadOnCreate;
	return settings;
}
