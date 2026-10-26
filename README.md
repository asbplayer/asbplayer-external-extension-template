# asbplayer-external-extension-template

A minimal [external extension](https://developer.chrome.com/docs/extensions/reference/api/runtime#event-onconnectexternal)
that demonstrates how to integrate with [asbplayer](https://github.com/asbplayer/asbplayer) through its external
extension API. Load it unpacked, approve it in asbplayer, and run its commands against any
media the asbplayer extension sees.

The external extension API shares its JSON-RPC 2.0 command set with asbplayer's WebSocket API,
so an external extension can target everything the WebSocket API targets.

## Try it

1. Build the sample: `pnpm install && pnpm build` (output in `.output/chrome-mv3`).
2. Open `chrome://extensions`, enable developer mode, and load the asbplayer extension unpacked if
   you haven't already. Copy its **extension ID** from the extension's card on that page.
3. Load `.output/chrome-mv3` as a second unpacked extension.
4. Open the sample's popup, paste the asbplayer extension ID, and press **Connect**. The sample
   sends an `initialize` request and then polls `approval-state` once per second until approval arrives.
   On subsequent popup opens it reconnects automatically using the saved extension ID.
5. Play a video on a streaming site so the asbplayer extension sees media. Until you approve the
   sample, commands are rejected with `-32002` and the log shows it awaiting approval.
6. Approve it from the **streaming video settings tab**: open the asbplayer extension popup (or
   options page, or the asbplayer web app settings), find the pending connection request showing
   the sample's name and extension ID, and press **Approve**. The sample detects the approval,
   verifies that command dispatch works, and becomes fully interactive.
7. Use the remaining commands against the media: mine a subtitle (opens asbplayer's Anki dialog),
   seek, load a built-in sample subtitle file, and fetch subtitles.

## Protocol

Connection: `browser.runtime.connect(<asbplayer extension ID>)` with port name
`asbplayer-external-v1`. Frames over the port are JSON-RPC 2.0, one message per port message:

| Direction                      | Frame                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| external extension → asbplayer | `{ jsonrpc: '2.0', id, method: 'initialize', params: { name?, version? } }`               |
| external extension → asbplayer | `{ jsonrpc: '2.0', id, method: 'approval-state', params: {} }`                            |
| external extension → asbplayer | `{ jsonrpc: '2.0', id, method: <command>, params }` (see `entrypoints/popup/protocol.ts`) |
| asbplayer → external extension | `{ jsonrpc: '2.0', id, result }` or `{ jsonrpc: '2.0', id, error }`                       |

Notes:

- Port messages are JSON-serializable values, and per-port message ordering is preserved, so
  `id` correlation is reliable.
- Requests and responses use the same method names and payloads as asbplayer's WebSocket server
  integration.
- `initialize` answers immediately with the current state: `{ state: 'approved' }` if the extension is
  already approved, otherwise `{ state: 'pending' }` after registering the approval request.
- While pending, poll `approval-state` (the sample uses one second). It returns `pending` until
  the user decides; approval makes the same connection usable. Denial returns `{ state: 'denied' }`
  once and asbplayer closes the port.
- Commands sent before approval are rejected with `-32002` (not approved); unknown methods get
  `-32601`; invalid params get `-32602`.
- Requests always get a response, so a per-request timeout (the sample uses 5 seconds) means
  asbplayer is unresponsive, not that approval is still pending.
- Revoking an approved extension closes the port without a message.
- Approval state is keyed on the connecting extension's ID and managed by the user from the
  streaming video settings of the asbplayer extension popup, options page, or the asbplayer web
  app.

## Commands

`entrypoints/popup/protocol.ts` defines the command set — `mine-subtitle`, `load-subtitles`, `seek-timestamp`,
`get-bound-media`, and `get-subtitles` — with the same payloads the WebSocket API accepts. The
types are duplicated here on purpose: the protocol, not asbplayer's code, is the contract, so an
external extension never needs to depend on asbplayer's packages.

## Building

The sample is self-contained and intentionally excluded from the pnpm workspace, so it never
interferes with the asbplayer build. It is built with [WXT](https://wxt.dev): the popup lives in
`entrypoints/popup/`, and the manifest is generated from `wxt.config.ts` at build time. The
project defines its own standalone pnpm workspace (`pnpm-workspace.yaml`), so installs here
never touch the parent workspace's lockfile.

```sh
pnpm install
pnpm build     # bundle to .output/chrome-mv3
pnpm compile   # typecheck
pnpm dev       # rebuild on change; reload the unpacked extension in the browser
```

## Licensing

The sample is released under the [Unlicense](UNLICENSE) — copying and redistribution
require no notice.
