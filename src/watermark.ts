import { R2UploaderSettings, WatermarkPosition } from "./settings";

export function buildFont(s: R2UploaderSettings, imageWidth: number): { font: string; size: number } {
	const autoSize = Math.min(120, Math.max(14, Math.round(imageWidth * 0.02)));
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
	switch (position) {
		case "bottom-right":
			return { x: Math.round(imgW - elemW - padding + ox), y: Math.round(imgH - padding + oy) };
		case "bottom-left":
			return { x: Math.round(padding + ox), y: Math.round(imgH - padding + oy) };
		case "bottom-center":
			return { x: Math.round((imgW - elemW) / 2 + ox), y: Math.round(imgH - padding + oy) };
		case "center":
			return { x: Math.round((imgW - elemW) / 2 + ox), y: Math.round((imgH + elemH) / 2 + oy) };
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
	const padding = Math.round(w * 0.015);
	const { x, y } = resolvePosition(
		s.watermarkPosition, w, h, textW, textH, padding,
		s.watermarkOffsetX, s.watermarkOffsetY,
	);
	ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
	ctx.lineWidth = textH * 0.12;
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
	const mimeType =
		ext === "png" ? "image/png" :
		ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
		ext === "webp" ? "image/webp" :
		ext === "svg" ? "image/svg+xml" :
		"image/png";

	await new Promise<void>((resolve, reject) => {
		const blob = new Blob([logoData], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			const logoW = Math.round((w * s.watermarkLogoSize) / 100);
			const logoH = Math.round((img.naturalHeight / img.naturalWidth) * logoW);
			const padding = Math.round(w * 0.015);
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
	const size = 12;
	for (let row = 0; row * size < h; row++) {
		for (let col = 0; col * size < w; col++) {
			ctx.fillStyle = (row + col) % 2 === 0 ? "#cccccc" : "#ffffff";
			ctx.fillRect(col * size, row * size, size, size);
		}
	}
}
