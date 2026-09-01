# Graph Writer / Design Studio

A mobile-first structured infinite canvas for visual design and AI implementation handoffs.

> Think visually → annotate intent → export structured design → hand off to Claude/Codex → implement

## Current milestone

WS-001 and WS-002 are implemented:

- React, TypeScript, Vite, and tldraw foundation
- Canonical versioned `StudioDocument` schema with validation
- Engine boundary through the canvas adapter
- Semantic objects with Design Intent metadata
- Local tldraw persistence
- Validated JSON import and clean JSON export
- Lossless semantic/geometry round-trip tests
- Mobile-first full-screen editor shell

The first architectural review gate is now available: tldraw owns canvas interaction while `StudioDocument` remains the clean durable format.

## Run locally

```bash
npm install
npm run dev
```

Validation:

```bash
npm test
npm run build
```

Set `VITE_TLDRAW_LICENSE_KEY` for production deployments when required by your tldraw license.

## Plan

See the [Design Studio v0.1 Product & Build Specification](docs/PRODUCT_SPEC.md).

Later workstreams should not begin until the `StudioDocument ↔ tldraw` boundary has been reviewed.
