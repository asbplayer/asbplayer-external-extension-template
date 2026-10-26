// SPDX-License-Identifier: Unlicense

import { ExternalConnection } from './connection';
import type {
    ApprovalState,
    BoundMedia,
    ExternalMethod,
    JsonRpcError,
    JsonRpcResponse,
    MethodParams,
    MethodResults,
} from './protocol';
import { PostMineAction, portName } from './protocol';

const selfName = 'asbplayer sample companion';

const sampleSrt = `1
00:00:00,000 --> 00:00:05,000
ねこ
`;
const sampleSrtBase64 = btoa(String.fromCharCode(...new TextEncoder().encode(sampleSrt)));

const extensionIdInput = document.querySelector<HTMLInputElement>('#extension-id')!;
const connectButton = document.querySelector<HTMLButtonElement>('#connect')!;
const disconnectButton = document.querySelector<HTMLButtonElement>('#disconnect')!;
const statusSpan = document.querySelector<HTMLSpanElement>('#status')!;
const logDiv = document.querySelector<HTMLDivElement>('#log')!;

const initializeButton = document.querySelector<HTMLButtonElement>('#initialize')!;
const getBoundMediaButton = document.querySelector<HTMLButtonElement>('#get-bound-media')!;
const mineSubtitleButton = document.querySelector<HTMLButtonElement>('#mine-subtitle')!;
const seekButton = document.querySelector<HTMLButtonElement>('#seek-timestamp')!;
const loadSubtitlesButton = document.querySelector<HTMLButtonElement>('#load-subtitles')!;
const getSubtitlesButton = document.querySelector<HTMLButtonElement>('#get-subtitles')!;

const commandButtons = [getBoundMediaButton, mineSubtitleButton, seekButton, loadSubtitlesButton, getSubtitlesButton];

let connection: ExternalConnection | undefined;
let approvalState: ApprovalState = 'pending';
let polling: ReturnType<typeof setInterval> | undefined;
let lastMedia: BoundMedia | undefined;

function log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logDiv.appendChild(document.createTextNode(`[${timestamp}] ${message}\n`));
    logDiv.scrollTop = logDiv.scrollHeight;
}

function setStatus() {
    if (connection === undefined) {
        statusSpan.textContent = 'Not connected';
    } else if (approvalState === 'approved') {
        statusSpan.textContent = 'Approved';
    } else if (approvalState === 'denied') {
        statusSpan.textContent = 'Denied';
    } else {
        statusSpan.textContent = 'Awaiting approval...';
    }

    for (const button of commandButtons) {
        button.disabled = connection === undefined || approvalState !== 'approved';
    }
}

function formatError(error: JsonRpcError) {
    return error.data === undefined
        ? `${error.message} (${error.code})`
        : `${error.message} (${error.code}): ${JSON.stringify(error.data)}`;
}

function applyApprovalState(state: ApprovalState) {
    const previous = approvalState;
    approvalState = state;
    setStatus();

    if (state === 'approved') {
        stopPolling();

        if (previous !== 'approved') {
            log('Approved! Commands are now dispatched.');
            void getBoundMedia().then((media) => {
                if (media !== undefined) {
                    log('Dispatch verified.');
                }
            });
        }

        return;
    }

    if (state === 'denied') {
        stopPolling();

        if (previous !== 'denied') {
            log('Approval was denied. asbplayer closed the connection.');
        }

        return;
    }

    startPolling();
}

async function sendInitialize() {
    const active = connection;

    if (active === undefined) {
        return;
    }

    const response = await active.request('initialize', {
        name: selfName,
        version: chrome.runtime.getManifest().version,
    });

    if (active !== connection) {
        return;
    }

    if (response === undefined) {
        log('<no response: initialize>');
        return;
    }

    if ('error' in response) {
        log(`initialize failed: ${formatError(response.error)}`);
        return;
    }

    applyApprovalState(response.result.state);
}

async function pollApprovalState() {
    const active = connection;

    if (active === undefined || active.disconnected) {
        stopPolling();
        return;
    }

    const response = await active.request('approval-state', {});

    if (active !== connection) {
        return;
    }

    if (response === undefined) {
        log('<no response: approval-state>');
        return;
    }

    if ('error' in response) {
        log(`approval-state failed: ${formatError(response.error)}`);
        return;
    }

    applyApprovalState(response.result.state);
}

function startPolling() {
    if (polling !== undefined || connection === undefined) {
        return;
    }

    polling = setInterval(() => void pollApprovalState(), 1000);
}

function stopPolling() {
    if (polling !== undefined) {
        clearInterval(polling);
        polling = undefined;
    }
}

async function sendRequest<M extends ExternalMethod>(
    method: M,
    params: MethodParams[M]
): Promise<MethodResults[M] | undefined> {
    const active = connection;

    if (active === undefined) {
        return undefined;
    }

    let response: JsonRpcResponse<unknown> | undefined;

    try {
        response = await active.request(method, params);
    } catch (error) {
        log(`${method} failed to send: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }

    if (active !== connection) {
        return undefined;
    }

    if (response === undefined) {
        log(`<no response: ${method}>`);
        return undefined;
    }

    if ('error' in response) {
        log(`${method} failed: ${formatError(response.error)}`);
        return undefined;
    }

    return response.result as MethodResults[M];
}

async function getBoundMedia() {
    const result = await sendRequest('get-bound-media', {});

    if (result === undefined) {
        return undefined;
    }

    lastMedia = result.media[0];
    log(JSON.stringify(result));
    return result;
}

function connect() {
    const asbplayerExtensionId = extensionIdInput.value.trim();

    if (asbplayerExtensionId === '') {
        log('Enter the asbplayer extension ID first (see chrome://extensions with developer mode on).');
        return;
    }

    void chrome.storage.local.set({ asbplayerExtensionId });

    let port: chrome.runtime.Port;

    try {
        port = chrome.runtime.connect(asbplayerExtensionId, { name: portName });
    } catch (error) {
        log(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }

    connection = new ExternalConnection(port);
    const newConnection = connection;
    approvalState = 'pending';

    connection.onDisconnect(() => {
        // A reconnect replaces the connection before the old port's disconnect event fires.
        if (connection !== newConnection) {
            return;
        }

        log('Disconnected from asbplayer.');
        teardown();
    });

    // Greet asbplayer; the response reflects the current approval state. If pending, start
    // polling `approval-state` until the user makes a decision.
    log(`Sent initialize as "${selfName}" to extension ${asbplayerExtensionId}.`);
    connectButton.textContent = 'Reconnect';
    setStatus();
    void sendInitialize();
}

function teardown() {
    connection = undefined;
    approvalState = 'pending';
    stopPolling();
    setStatus();
}

connectButton.addEventListener('click', () => {
    if (connection !== undefined) {
        connection.disconnect();
    }

    teardown();
    connect();
});

disconnectButton.addEventListener('click', () => {
    connection?.disconnect();
});

initializeButton.addEventListener('click', () => {
    log('Sending initialize...');
    void sendInitialize();
});

getBoundMediaButton.addEventListener('click', () => void getBoundMedia());

mineSubtitleButton.addEventListener('click', () => {
    log('Mining subtitle with sample fields...');
    void sendRequest('mine-subtitle', {
        fields: { word: 'ねこ', sentence: 'ねこ' },
        postMineAction: PostMineAction.showAnkiDialog,
        ...(lastMedia !== undefined ? { mediaId: lastMedia.id } : {}),
    });
});

seekButton.addEventListener('click', () => {
    void sendRequest('seek-timestamp', {
        timestamp: 30,
        ...(lastMedia !== undefined ? { mediaId: lastMedia.id } : {}),
    });
    log('Requested seek to 30s.');
});

loadSubtitlesButton.addEventListener('click', () => {
    void sendRequest('load-subtitles', {
        files: [{ base64: sampleSrtBase64, name: 'sample.srt' }],
        ...(lastMedia !== undefined ? { mediaId: lastMedia.id } : {}),
    });
    log('Requested load of sample.srt.');
});

getSubtitlesButton.addEventListener('click', async () => {
    if (lastMedia === undefined) {
        log('Fetch bound media first to target a media source.');
        return;
    }

    await sendRequest('get-subtitles', { mediaId: lastMedia.id });
});

setStatus();

chrome.storage.local.get('asbplayerExtensionId').then((result) => {
    const id = (result as Record<string, string | undefined>).asbplayerExtensionId;

    if (id !== undefined && id !== '') {
        extensionIdInput.value = id;
        // Approval persists on the asbplayer side, so reconnect automatically (the port cannot
        // outlive the popup).
        connect();
    } else {
        log(
            'Enter the asbplayer extension ID and press Connect. Approve this extension from the asbplayer extension popup.'
        );
    }
});
