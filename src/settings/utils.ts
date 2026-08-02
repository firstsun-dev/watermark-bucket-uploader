export function debounce<Args extends unknown[]>(
	fn: (...args: Args) => void,
	delayMs: number,
): (...args: Args) => void {
	let handle: number | undefined;
	return (...args: Args) => {
		if (handle !== undefined) activeWindow.clearTimeout(handle);
		handle = activeWindow.setTimeout(() => {
			handle = undefined;
			fn(...args);
		}, delayMs);
	};
}
