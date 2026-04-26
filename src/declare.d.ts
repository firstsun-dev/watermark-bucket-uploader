declare module '@smithy/fetch-http-handler/dist-es/request-timeout' {
    export function requestTimeout(ms?: number): Promise<never>;
}

declare interface AbortSignal {
    readonly aborted: boolean;
    onabort: ((this: AbortSignal, ev: Event) => void) | null;
    addEventListener(type: 'abort', listener: (this: AbortSignal, ev: Event) => void, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: 'abort', listener: (this: AbortSignal, ev: Event) => void, options?: boolean | EventListenerOptions): void;
}
