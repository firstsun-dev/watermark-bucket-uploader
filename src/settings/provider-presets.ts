import type { R2UploaderSettings, StorageProvider } from "./types";

export interface ProviderPreset {
	id: StorageProvider;
	label: string;
	region: string;
	useCustomEndpoint: boolean;
	forcePathStyle: boolean;
	endpointPlaceholder: string;
	endpointHint: string;
}

export const PROVIDER_PRESETS: Record<StorageProvider, ProviderPreset> = {
	r2: {
		id: "r2",
		label: "Cloudflare R2",
		region: "auto",
		useCustomEndpoint: true,
		forcePathStyle: false,
		endpointPlaceholder: "https://<account-id>.r2.cloudflarestorage.com/",
		endpointHint: "Found in the Cloudflare dashboard under R2 → Manage API tokens.",
	},
	s3: {
		id: "s3",
		label: "AWS S3",
		region: "us-east-1",
		useCustomEndpoint: false,
		forcePathStyle: false,
		endpointPlaceholder: "",
		endpointHint: "AWS S3 resolves the endpoint from the region automatically.",
	},
	minio: {
		id: "minio",
		label: "MinIO",
		region: "us-east-1",
		useCustomEndpoint: true,
		forcePathStyle: true,
		endpointPlaceholder: "https://minio.example.com:9000/",
		endpointHint: "MinIO typically requires path-style URLs.",
	},
	b2: {
		id: "b2",
		label: "Backblaze B2",
		region: "us-west-004",
		useCustomEndpoint: true,
		forcePathStyle: false,
		endpointPlaceholder: "https://s3.us-west-004.backblazeb2.com/",
		endpointHint: "Found in the B2 bucket details page.",
	},
	custom: {
		id: "custom",
		label: "Custom S3-compatible",
		region: "",
		useCustomEndpoint: true,
		forcePathStyle: false,
		endpointPlaceholder: "https://s3.example.com/",
		endpointHint: "Any S3-compatible endpoint.",
	},
};

/**
 * Applies a provider's default region/endpoint-mode settings. Only fills in defaults —
 * never overwrites credentials, bucket name, or an endpoint URL the user already typed.
 */
export function applyProviderDefaults(settings: R2UploaderSettings, provider: StorageProvider): void {
	const preset = PROVIDER_PRESETS[provider];
	settings.storageProvider = provider;
	if (!settings.region) settings.region = preset.region;
	settings.useCustomEndpoint = preset.useCustomEndpoint;
	settings.forcePathStyle = preset.forcePathStyle;
}
