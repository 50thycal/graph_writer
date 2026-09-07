# Altitude levels

Graph Writer canvases can now zoom in and out. Any object can open into its own
level: a smaller canvas that explains how that object works inside. The level
above keeps seeing it as one box.

This exists because a good build plan is not one huge graph. It is a short core
loop you can agree on in a glance, with the risky part broken out and worked on
by itself, and the pieces connected only once each one holds up.

## The workflow it supports

```text
1. Root level        The core loop. Five to eight objects, one screen.
2. Zoom in           Pick the object that carries the most uncertainty.
                     Break it into the pieces that make it work.
3. Hand off a level  Export just that chunk. The brief carries the zoomed-out
                     context (what it lives inside, its neighbours) so the
                     coding agent knows where it fits without seeing everything.
4. Build and verify  Get that chunk working on its own.
5. Zoom out          Connect it to its neighbours. Repeat with the next chunk.
```

The hard part goes first. If an idea depends on an external integration nobody
has proven yet, that object is the one to zoom into, not the parts an agent can
already build well.

## Using it

- **Badges.** Objects that own a level show a `▾ N inside` pill. Tap it to zoom in.
  The selected object shows `＋ Zoom in`, which creates its level.
- **Level bar.** The breadcrumb at the top of the canvas shows where you are.
  Tap any ancestor to zoom out to it. The `↑` button goes up one level.
- **Browser back.** Each zoom is a history entry, so Back zooms out. The URL
  carries the level, so a reload lands where you were.
- **Inspector.** The Altitude section on any object opens its level, and inside a
  level it can move the object up to the level above.
- **Deleting.** Deleting an object on the canvas deletes everything inside it.
- **Handoff.** The brief covers the current level only, with a zoomed-out
  context section, the neighbours at the level above, which objects on this
  level are black boxes, and connections that cross into other levels. The JSON
  always contains the whole document.

## Data model

Levels are one optional field on `StudioElement`:

```ts
parentElementId?: string   // omitted at the root level
```

Everything stays inside one `StudioDocument`, so import, export, versions and
the round-trip guarantee are unchanged. Validation rejects a missing parent and
any cycle. Connections belong to the level of their endpoints; a connection
whose endpoints are on different levels is kept in the document and listed in
the handoff, but not drawn.

The Kalshi example maps in `docs/examples/` were previously six files linked by
`properties.detailMap`. `kalshi-bot-levels.json` is the same content as one
multi-level document, produced by `scripts/merge-kalshi-levels.mjs`.
