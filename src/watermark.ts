import { R2UploaderSettings, WatermarkPosition } from "./settings/types";

const FONT_SIZE_FACTOR = 0.02;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 120;
const LINE_WIDTH_FACTOR = 0.12;
const PADDING_FACTOR = 0.015;
const CHECKERBOARD_SIZE = 12;

export function buildFont(s: R2UploaderSettings, imageWidth: number): { font: string; size: number } {
	const autoSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(imageWidth * FONT_SIZE_FACTOR)));
	const size = s.watermarkFontSize > 0 ? s.watermarkFontSize : autoSize;
	const parts: string[] = [];
	if (s.watermarkBold) parts.push("bold");
	if (s.watermarkItalic) parts.push("italic");
	parts.push(`${size}px`);
	parts.push(s.watermarkFontFamily || "Arial");
	return { font: parts.join(" "), size };
}

export function resolvePosition(
	position: WatermarkPosition,
	imgW: number,
	imgH: number,
	elemW: number,
	elemH: number,
	padding: number,
	offsetXPct = 0,
	offsetYPct = 0,
): { x: number; y: number } {
	const ox = Math.round((imgW * offsetXPct) / 100);
	const oy = Math.round((imgH * offsetYPct) / 100);
	const left = Math.round(padding + ox);
	const centerX = Math.round((imgW - elemW) / 2 + ox);
	const right = Math.round(imgW - elemW - padding + ox);
	const top = Math.round(padding + elemH + oy);
	const centerY = Math.round((imgH + elemH) / 2 + oy);
	const bottom = Math.round(imgH - padding + oy);
	switch (position) {
		case "top-left":
			return { x: left, y: top };
		case "top-center":
			return { x: centerX, y: top };
		case "top-right":
			return { x: right, y: top };
		case "center-left":
			return { x: left, y: centerY };
		case "center":
			return { x: centerX, y: centerY };
		case "center-right":
			return { x: right, y: centerY };
		case "bottom-left":
			return { x: left, y: bottom };
		case "bottom-center":
			return { x: centerX, y: bottom };
		case "bottom-right":
		default:
			return { x: right, y: bottom };
	}
}

export function paintTextWatermark(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	s: R2UploaderSettings,
): void {
	if (!s.watermarkEnabled || !s.watermarkText) return;
	const { font, size: textH } = buildFont(s, w);
	ctx.save();
	ctx.font = font;
	const metrics = ctx.measureText(s.watermarkText);
	const textW = metrics.width;
	const padding = Math.round(w * PADDING_FACTOR);
	const { x, y } = resolvePosition(
		s.watermarkPosition, w, h, textW, textH, padding,
		s.watermarkOffsetX, s.watermarkOffsetY,
	);
	ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
	ctx.lineWidth = textH * LINE_WIDTH_FACTOR;
	ctx.lineJoin = "round";
	ctx.strokeText(s.watermarkText, x, y);
	ctx.fillStyle = s.watermarkColor;
	ctx.fillText(s.watermarkText, x, y);
	ctx.restore();
}

export async function paintLogoWatermark(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	s: R2UploaderSettings,
	logoData: ArrayBuffer,
): Promise<void> {
	const ext = s.watermarkLogoPath.split(".").pop()?.toLowerCase() ?? "";
	
	let mimeType = "image/png";
	if (ext === "png") {
		mimeType = "image/png";
	} else if (ext === "jpg" || ext === "jpeg") {
		mimeType = "image/jpeg";
	} else if (ext === "webp") {
		mimeType = "image/webp";
	} else if (ext === "svg") {
		mimeType = "image/svg+xml";
	}

	await new Promise<void>((resolve, reject) => {
		const blob = new Blob([logoData], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			const logoW = Math.round((w * s.watermarkLogoSize) / 100);
			const logoH = Math.round((img.naturalHeight / img.naturalWidth) * logoW);
			const padding = Math.round(w * PADDING_FACTOR);
			const { x, y } = resolvePosition(
				s.watermarkLogoPosition, w, h, logoW, logoH, padding,
				s.watermarkLogoOffsetX, s.watermarkLogoOffsetY,
			);
			ctx.save();
			ctx.globalAlpha = s.watermarkLogoOpacity;
			ctx.drawImage(img, x, y - logoH, logoW, logoH);
			ctx.restore();
			URL.revokeObjectURL(url);
			resolve();
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("Logo image load failed"));
		};
		img.src = url;
	});
}

export function paintCheckerboard(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
): void {
	for (let row = 0; row * CHECKERBOARD_SIZE < h; row++) {
		for (let col = 0; col * CHECKERBOARD_SIZE < w; col++) {
			ctx.fillStyle = (row + col) % 2 === 0 ? "#cccccc" : "#ffffff";
			ctx.fillRect(col * CHECKERBOARD_SIZE, row * CHECKERBOARD_SIZE, CHECKERBOARD_SIZE, CHECKERBOARD_SIZE);
		}
	}
}
