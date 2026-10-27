# asbplayer-external-extension-template

A minimal [external extension](https://docs.asbplayer.dev/docs/guides/external-extensions)
that demonstrates how to integrate with [asbplayer](https://github.com/asbplayer/asbplayer) through its external
extension API.

## Getting started

1. Build the extension to`.output/chrome-mv3`:
   ```
   pnpm install && pnpm build
   ```
2. Load `.output/chrome-mv3` as an unpacked extension from your browser's extension manager.
3. Open the sample's popup, paste asbplayer's extension ID, and press **Connect**.
4. A badge should appear on the asbplayer extension button. Opening asbplayer's popup should show the approval dialog.
5. Approve the external extension from the popup.
6. Command buttons from the external extension should start working.

## Protocol

A connection is obtained using `browser.runtime.connect(<asbplayer extension ID>)` with port name
`asbplayer-external-v1`. Frames sent over the port are JSON-RPC 2.0, with one response per request.

| Direction                      | Frame                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| external extension → asbplayer | `{ jsonrpc: '2.0', id, method: 'initialize', params: { name?, version? } }`               |
| external extension → asbplayer | `{ jsonrpc: '2.0', id, method: 'approval-state', params: {} }`                            |
| external extension → asbplayer | `{ jsonrpc: '2.0', id, method: <command>, params }` (see `entrypoints/popup/protocol.ts`) |
| asbplayer → external extension | `{ jsonrpc: '2.0', id, result }` or `{ jsonrpc: '2.0', id, error }`                       |

The initialization protocol is documented in the [guide](https://docs.asbplayer.dev/docs/guides/external-extensions) and the possible commands are documented in the [reference](https://docs.asbplayer.dev/docs/reference/external-api).

As of this writing, the external extension in this repo supports all of the documented commands.

## Building

```sh
pnpm install.  # install deps
pnpm build     # bundle to .output/chrome-mv3
pnpm compile   # typecheck
pnpm dev       # start wxt hotswap server
```

## Licensing

The sample is released under the [Unlicense](UNLICENSE). Copying and redistribution
require no notice.
