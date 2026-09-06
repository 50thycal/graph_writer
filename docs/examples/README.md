# Example documents

Importable `StudioDocument` files (schemaVersion 1). Open Graph Writer → import JSON.

## Kalshi bot system maps

A master map plus five subsystem maps, all in `architecture` mode. Read the master
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
