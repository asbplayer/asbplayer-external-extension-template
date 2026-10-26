// SPDX-License-Identifier: Unlicense

import type {
    ExternalMethod,
    JsonRpcNotification,
    JsonRpcRequest,
    JsonRpcResponse,
    MethodParams,
    MethodResults,
} from './protocol';

/**
 * Request/response correlation over an external connection port, by JSON-RPC `id`. Every request
 * is answered with a result or an error, so a timeout means the connection or asbplayer is not
 * responding -- not that the request is waiting for human approval.
 */
export class ExternalConnection {
    private readonly _port: chrome.runtime.Port;
    private readonly _requests = new Map<string, (response: JsonRpcResponse<unknown> | undefined) => void>();
    private readonly _messageListeners: ((message: unknown) => void)[] = [];
    private readonly _disconnectListeners: (() => void)[] = [];
    private _disconnected = false;

    constructor(
        port: chrome.runtime.Port,
        private readonly _timeoutMs = 5000
    ) {
        this._port = port;
        port.onMessage.addListener((message) => this._onMessage(message));
        port.onDisconnect.addListener(() => this._onDisconnect());
    }

    get id() {
        return this._port.sender?.id;
    }

    onMessage(listener: (message: unknown) => void) {
        this._messageListeners.push(listener);
    }

    onDisconnect(listener: () => void) {
        this._disconnectListeners.push(listener);
    }

    get disconnected() {
        return this._disconnected;
    }

    disconnect() {
        this._port.disconnect();
        this._onDisconnect();
    }

    /** Posts a notification: no `id`, and no response is expected. */
    post(notification: JsonRpcNotification) {
        this._port.postMessage(notification);
    }

    /**
     * Sends a JSON-RPC request and correlates the response by id. Resolves `undefined` on timeout
     * or disconnect; rejects if the post itself fails. Errors from asbplayer are returned as an
     * `error` response rather than thrown.
     */
    async request<M extends ExternalMethod>(
        method: M,
        params: MethodParams[M]
    ): Promise<JsonRpcResponse<MethodResults[M]> | undefined> {
        const id = crypto.randomUUID();

        return new Promise<JsonRpcResponse<MethodResults[M]> | undefined>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._requests.delete(id);
                resolve(undefined);
            }, this._timeoutMs);

            this._requests.set(id, (response) => {
                clearTimeout(timeout);
                resolve(response as JsonRpcResponse<MethodResults[M]> | undefined);
            });

            const request: JsonRpcRequest<MethodParams[M]> = { jsonrpc: '2.0', id, method, params };

            try {
                this._port.postMessage(request);
            } catch (error) {
                clearTimeout(timeout);
                this._requests.delete(id);
                reject(error);
            }
        });
    }

    private _onMessage(message: unknown) {
        const response = message as { jsonrpc?: unknown; id?: unknown } | undefined;

        if (response?.jsonrpc === '2.0' && typeof response.id === 'string') {
            const resolve = this._requests.get(response.id);

            if (resolve !== undefined) {
                this._requests.delete(response.id);
                resolve(message as JsonRpcResponse<unknown>);
                return;
            }
        }

        for (const listener of this._messageListeners) {
            listener(message);
        }
    }

    private _onDisconnect() {
        if (this._disconnected) {
            return;
        }

        this._disconnected = true;

        for (const resolve of this._requests.values()) {
            resolve(undefined);
        }

        this._requests.clear();

        for (const listener of this._disconnectListeners) {
            listener();
        }
    }
}
