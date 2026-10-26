# asbplayer-external-extension-template

A minimal [external extension](https://developer.chrome.com/docs/extensions/reference/api/runtime#event-onconnectexternal)
that demonstrates how to integrate with [asbplayer](https://github.com/asbplayer/asbplayer) through its external
extension API. Load it unpacked, approve it in asbplayer, and run its commands against any
media the asbplayer extension sees.

The external extension API shares its command set and wire format with asbplayer's WebSocket API,
so an external extension can target everything the WebSocket API targets.

## Try it

1. Build the sample: `pnpm install && pnpm build` (output in `.output/chrome-mv3`).
2. Open `chrome://extensions`, enable developer mode, and load the asbplayer extension unpacked if
   you haven't already. Copy its **extension ID** from the extension's card on that page.
3. Load `.output/chrome-mv3` as a second unpacked extension.
4. Open the sample's popup, paste the asbplayer extension ID, and press **Connect**. The sample
   sends a `hello` frame and then retries `get-bound-media` every 2 seconds until approval
   arrives. On subsequent popup opens it reconnects automatically using the saved extension ID.
5. Play a video on a streaming site so the asbplayer extension sees media. Until you approve the
   sample, its requests receive no response and the log shows it awaiting approval.
6. Approve it from the **streaming video settings tab**: open the asbplayer extension popup (or
   options page, or the asbplayer web app settings), find the pending connection request showing
   the sample's name and extension ID, and press **Approve**. The sample detects the approval,
   verifies that command dispatch works, and becomes fully interactive.
7. Use the remaining commands against the media: mine a subtitle (opens asbplayer's Anki dialog),
   seek, load a built-in sample subtitle file, and fetch subtitles.

## Protocol

Connection: `browser.runtime.connect(<asbplayer extension ID>)` with port name
`asbplayer-external-v1`. Frames over the port:

| Direction | Frame |
| --------- | ----- |
| external extension → asbplayer | `{ type: 'asbplayer-external-hello', name?, version? }` |
| asbplayer → external extension | `{ type: 'asbplayer-external-approval', approved: boolean }` |
| external extension → asbplayer | `{ command: <command>, messageId, body }` (see `entrypoints/popup/protocol.ts`) |
| asbplayer → external extension | `{ command: 'response', messageId, body }` |

Notes:

- Port messages are JSON-serializable values, and per-port message ordering is preserved, so
  `messageId` correlation is reliable.
- Requests and responses use the same wire format as asbplayer's WebSocket server integration.
- Unapproved extensions receive no responses to their commands, and commands the extension does
  not handle stay silent, so apply a per-request timeout (the sample uses 5 seconds) and treat
  silence as "not yet approved" or "not handled".
- The `asbplayer-external-approval` frame is posted as soon as the port opens, again in
  response to `hello`, and again whenever the user approves or revokes the extension while the
  port is open.
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
