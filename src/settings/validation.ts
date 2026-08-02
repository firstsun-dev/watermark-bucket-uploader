export interface FieldValidationResult {
	valid: boolean;
	message?: string;
}

const ok: FieldValidationResult = { valid: true };

export function isRequired(value: string, fieldLabel: string): FieldValidationResult {
	if (!value.trim()) return { valid: false, message: `${fieldLabel} is required.` };
	return ok;
}

/** Accepts values with or without a protocol; only flags structurally invalid URLs or a missing protocol. */
export function validateHttpsUrl(value: string, opts: { required?: boolean } = {}): FieldValidationResult {
	const trimmed = value.trim();
	if (!trimmed) return opts.required ? { valid: false, message: "This field is required." } : ok;
	if (!/^https?:\/\//i.test(trimmed)) {
		return { valid: false, message: "URL must start with http:// or https://." };
	}
	try {
		new URL(trimmed);
	} catch {
		return { valid: false, message: "Enter a valid HTTPS endpoint." };
	}
	return ok;
}

export function validateBucketName(value: string): FieldValidationResult {
	return isRequired(value, "Bucket name");
}

export function validateRegion(value: string): FieldValidationResult {
	return isRequired(value, "Region");
}

/** Normalizes a bare host/URL into a well-formed https:// URL with a trailing slash. Call on blur/save only. */
export function normalizeUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return trimmed;
	let normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	normalized = normalized.replace(/([^/])$/, "$1/");
	return normalized;
}
