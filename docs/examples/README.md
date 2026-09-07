# Example documents

Importable `StudioDocument` files (schemaVersion 1). Open Graph Writer → import JSON.

## Kalshi bot system maps

`kalshi-bot-levels.json` is the whole system as one multi-level document: the root
shows the major systems, and five of them zoom into their own level. Import this one
to browse the map with the level bar and badges. It is generated from the files below
by `node scripts/merge-kalshi-levels.mjs`.

The separate files remain for readers who want one map per file. Read the master
first; every node that expands into its own map names it in `properties.detailMap`,
and each subsystem map points back through `metadata.parentMap`.

| File | What it answers |
|---|---|
| `kalshi-bot-master.json` | What are the major systems and how do they connect? |
| `kalshi-bot-trading-pipeline.json` | How does one cycle turn exchange data into a paper, live or twin position — and what stops it? |
| `kalshi-bot-experiment-os.json` | How does a question become a tag that may trade, and what decides whether it keeps trading? |
| `kalshi-bot-research-data.json` | Where does research data come from, and how does a dataset earn a book? |
| `kalshi-bot-control-plane.json` | How do an operator and an agent session reach a system whose sandbox cannot? |
| `kalshi-bot-evo-fleet.json` | How does the agent population research, trade and get selected? |

`kalshi-bot-system.json` is the earlier single-canvas version of the same content. It is
kept as a stress case for layout work — 45 nodes and 52 connections on one canvas, with
~99 edge crossings — not as a document to read.

## Subway tabletop

`subway-tabletop.json` — `board-game` mode. The physical table for the Subway prototype in
`50thycal/party-games` (`src/games/subway/`): pegboard at the centre, opponent edge and public
schedule above it, contract office and card market to the left, logbook and pieces to the right,
your own edge in front. 27 pieces, 23 connections.

Piece positions mirror the implemented tabletop world rather than an abstract graph, so the
document reads as a table you could sit at. Every element type resolves in the board-game catalog,
so the inspector shows real property fields (`drawRule`, `visibility`, `capacity`, `state`).

## Layout conventions used by these maps

Straight center-to-center arrows with mid-path labels only stay readable if the layout
cooperates. These files follow four rules:

1. **Left-to-right rank grid.** Columns are pitched 410px apart, rows 190px. A node's
   column is its position in the flow, so most edges connect adjacent columns.
2. **Mirrored hubs instead of long edges.** A node that everything touches (the exchange,
   Postgres) is drawn more than once, tagged `mirror` with `properties.mirrorOf` naming
   the original.
3. **Short labels, long intent.** Edge labels are three words or fewer; the reasoning
   lives in `intent`, which the inspector shows on selection instead of the canvas.
4. **Annotations are not edges.** A relationship that only qualifies a node ("config
   validates book specs before a cycle runs") is an `intent` line on that node, not a
   drawn dependency.

Each map is checked for element-box overlaps, edges passing through unrelated boxes, and
edge–edge crossings before it is committed.
