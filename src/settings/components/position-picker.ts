import type { WatermarkPosition } from "../types";

interface PositionCellDef {
	value: WatermarkPosition;
	label: string;
}

// Row-major order matches visual layout of the 3×3 grid.
const POSITIONS: PositionCellDef[] = [
	{ value: "top-left", label: "Top left" },
	{ value: "top-center", label: "Top center" },
	{ value: "top-right", label: "Top right" },
	{ value: "center-left", label: "Center left" },
	{ value: "center", label: "Center" },
	{ value: "center-right", label: "Center right" },
	{ value: "bottom-left", label: "Bottom left" },
	{ value: "bottom-center", label: "Bottom center" },
	{ value: "bottom-right", label: "Bottom right" },
];

/**
 * Renders a 3×3 grid of position cells with real radio-button semantics
 * (role="radiogroup" / role="radio", roving tabindex, arrow-key navigation).
 * Reusable — instantiate once per watermark type with its own value/onChange.
 */
export function renderPositionPicker(
	container: HTMLElement,
	label: string,
	value: WatermarkPosition,
	onChange: (pos: WatermarkPosition) => void,
): void {
	let current = value;

	const wrap = container.createDiv({ cls: "r2-position-picker" });
	wrap.createDiv({ cls: "r2-position-picker-label", text: label });

	const grid = wrap.createDiv({ cls: "r2-position-grid" });
	grid.setAttribute("role", "radiogroup");
	grid.setAttribute("aria-label", label);

	const cells: HTMLElement[] = [];

	function setActive(index: number, fireChange: boolean): void {
		const def = POSITIONS[index];
		current = def.value;
		cells.forEach((cell, i) => {
			const selected = i === index;
			cell.toggleClass("is-selected", selected);
			cell.setAttribute("aria-checked", selected ? "true" : "false");
			cell.setAttribute("tabindex", selected ? "0" : "-1");
		});
		if (fireChange) onChange(def.value);
	}

	function moveFocus(fromIndex: number, key: string): void {
		const row = Math.floor(fromIndex / 3);
		const col = fromIndex % 3;
		let nextIndex = fromIndex;
		if (key === "ArrowRight") nextIndex = row * 3 + ((col + 1) % 3);
		else if (key === "ArrowLeft") nextIndex = row * 3 + ((col + 2) % 3);
		else if (key === "ArrowDown") nextIndex = ((row + 1) % 3) * 3 + col;
		else if (key === "ArrowUp") nextIndex = ((row + 2) % 3) * 3 + col;
		setActive(nextIndex, true);
		cells[nextIndex]?.focus();
	}

	POSITIONS.forEach((def, index) => {
		const cell = grid.createDiv({ cls: "r2-position-cell" });
		cell.setAttribute("role", "radio");
		cell.setAttribute("aria-label", def.label);
		cell.setAttribute("data-position", def.value);
		const selected = def.value === current;
		cell.setAttribute("aria-checked", selected ? "true" : "false");
		cell.setAttribute("tabindex", selected ? "0" : "-1");
		cell.toggleClass("is-selected", selected);
		cell.createSpan({ cls: "r2-position-dot" });

		cell.addEventListener("click", () => {
			setActive(index, true);
			cell.focus();
		});
		cell.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter" || evt.key === " ") {
				evt.preventDefault();
				setActive(index, true);
			} else if (
				evt.key === "ArrowRight" ||
				evt.key === "ArrowLeft" ||
				evt.key === "ArrowUp" ||
				evt.key === "ArrowDown"
			) {
				evt.preventDefault();
				moveFocus(index, evt.key);
			}
		});

		cells.push(cell);
	});
}
