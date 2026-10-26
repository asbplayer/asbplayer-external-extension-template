// SPDX-License-Identifier: Unlicense

// Protocol types for asbplayer's external extension API, kept as a local copy so that an
// external extension only needs this file and never asbplayer's packages.
//
// Frames travel over a browser.runtime.connect port named {@link portName} and use JSON-RPC 2.0.
// One message per port message, no batches:
//
//   external extension -> asbplayer:
//     { jsonrpc: '2.0', id, method: 'initialize', params: { name?, version? } }
//     { jsonrpc: '2.0', id, method: 'approval-state', params: {} }
//     { jsonrpc: '2.0', id, method: <command>, params: object }
//   asbplayer -> external extension:
//     { jsonrpc: '2.0', id, result: object } or { jsonrpc: '2.0', id, error: object }
//
// `initialize` and `approval-state` are extension-only methods used for approval. Commands are the
// same methods the WebSocket server integration accepts. A frame sent without an `id` is a
// notification and is never answered.

export const portName = 'asbplayer-external-v1';

export interface JsonRpcError {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
}

export interface JsonRpcRequest<TParams = unknown> {
    readonly jsonrpc: '2.0';
    readonly id: string;
    readonly method: string;
    readonly params?: TParams;
}

export interface JsonRpcNotification<TParams = unknown> {
    readonly jsonrpc: '2.0';
    readonly method: string;
    readonly params?: TParams;
}

export interface JsonRpcSuccessResponse<TResult> {
    readonly jsonrpc: '2.0';
    readonly id: string;
    readonly result: TResult;
}

export interface JsonRpcErrorResponse {
    readonly jsonrpc: '2.0';
    readonly id: string;
    readonly error: JsonRpcError;
}

export type JsonRpcResponse<TResult> = JsonRpcSuccessResponse<TResult> | JsonRpcErrorResponse;

export type ApprovalState = 'approved' | 'pending' | 'denied';

// `initialize` returns immediately with the current state. If pending, poll `approval-state`.
export interface InitializeParams {
    /** Self-reported, untrusted display name shown next to the extension ID in asbplayer's approval UI. */
    readonly name?: string;
    readonly version?: string;
}

export interface InitializeResult {
    readonly state: 'approved' | 'pending';
}

export interface ApprovalStateResult {
    readonly state: ApprovalState;
}

export interface MineSubtitleParams {
    readonly fields: { [key: string]: string };
    readonly postMineAction: number;
    readonly mediaId?: string;
    readonly noteId?: number;
}

export interface MineSubtitleResult {
    /** Whether the mining flow was accepted (dispatched), not whether a card was completed. */
    readonly published: boolean;
}

export interface LoadSubtitlesParams {
    readonly files?: { base64: string; name: string }[];
    readonly mediaId?: string;
}

export interface SeekTimestampParams {
    readonly timestamp: number;
    readonly mediaId?: string;
}

export interface GetBoundMediaParams {}

export interface BoundMedia {
    readonly id: string; // Derived from a hash of `streaming:<tabId>:<src>` or `local:<asbplayerId>`.
    readonly type: 'streaming' | 'local';
    readonly title?: string;
    readonly faviconUrl?: string;
    readonly loadedSubtitles: { trackNumber: number; fileName: string }[];
    readonly active: boolean;
}

export interface GetBoundMediaResult {
    readonly media: BoundMedia[];
}

export interface GetSubtitlesParams {
    readonly mediaId?: string;
    readonly trackNumbers?: number[];
}

export interface SubtitleCue {
    readonly text: string;
    readonly start: number;
    readonly end: number;
    readonly track: number;
}

export interface GetSubtitlesResult {
    readonly subtitles: SubtitleCue[];
}

export interface MethodParams {
    readonly initialize: InitializeParams;
    readonly 'approval-state': Record<string, never>;
    readonly 'mine-subtitle': MineSubtitleParams;
    readonly 'load-subtitles': LoadSubtitlesParams;
    readonly 'seek-timestamp': SeekTimestampParams;
    readonly 'get-bound-media': GetBoundMediaParams;
    readonly 'get-subtitles': GetSubtitlesParams;
}

export interface MethodResults {
    readonly initialize: InitializeResult;
    readonly 'approval-state': ApprovalStateResult;
    readonly 'mine-subtitle': MineSubtitleResult;
    readonly 'load-subtitles': Record<string, never>;
    readonly 'seek-timestamp': Record<string, never>;
    readonly 'get-bound-media': GetBoundMediaResult;
    readonly 'get-subtitles': GetSubtitlesResult;
}

export type ExternalMethod = keyof MethodParams;

// Post-mine actions, same values as asbplayer's PostMineAction enum.
export const PostMineAction = {
    none: 0,
    showAnkiDialog: 1,
    updateLastCard: 2,
    exportCard: 3,
    showUpdateCardDialog: 4,
} as const;
