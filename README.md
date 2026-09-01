# graph_writer

Graph Writer is the repository for **Design Studio**, a mobile-first structured infinite canvas built on tldraw.

The product connects visual design to AI-assisted implementation:

> Think visually → annotate intent → export structured design → hand off to Claude/Codex → implement

## Approved plan

See the [Design Studio v0.1 Product & Build Specification](docs/PRODUCT_SPEC.md).

The first implementation milestone is intentionally limited to **WS-001 and WS-002**:

- Mobile-friendly React/Vite/TypeScript and tldraw foundation
- Canonical, engine-independent `StudioDocument`
- Canvas adapter boundary
- Basic semantic object
- Lossless JSON round trip

Later workstreams should not begin until the `StudioDocument ↔ tldraw` boundary has been demonstrated and reviewed.
