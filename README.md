# SAP BTP Knowledge Graph — KG vs RAG

> Rebuilt a real SAP PO to show why Knowledge Graph changes everything for ERP AI.

At **SAP Sapphire 2026**, SAP announced Knowledge Graph as the grounding layer for Joule agents. Most coverage copied the press release. Here is what the actual data structure looks like — and why it changes everything for ERP AI.

---

## The Problem: A Purchase Order Lives Across Five Tables

| Table | Content |
|-------|---------|
| **EKKO** | PO header (vendor, currency, total) |
| **EKPO** | PO line items (material, plant, G/L, tax code) |
| **LFA1** | Vendor master (blocks, payment terms, industry) |
| **MARA** | Material master (type, origin, profit centre) |
| **SKA1** | G/L account (chart, P&L type, business transaction) |

SAP Knowledge Graph maps these five tables into a **semantic graph**:

```
PO-4500023847
├── [ordered_from]        → LFA1-45000123 (REFOX AG)
│                            blocks = ""  ✓
│                            deletion = "" ✓
├── [contains_line_items] → EKPO-00010
│                            material = M-7700-SMD
│                            posts_to = GL-400020
│                            tax_code = CH-VAT-Norm
├── [triggers_compliance] → TAX-CH-VAT-Norm
                              rate = 7.7% domestic CH
```

Every edge is **typed**. Every node has **deterministic properties**.

Agent asks: *"Is vendor REFOX blocked?"*  
→ Traverses `purchasing_block == ""`  
→ Answer is **true**. Not a similarity score. A **property**.

---

## Why RAG Cannot Do This

Ask RAG the same question — it returns text chunks mentioning "blocked."

| | Knowledge Graph | RAG |
|---|---|---|
| **Answer** | Property-based, deterministic | Probabilistic, similarity-based |
| **Explainability** | Typed edges, full trace | "Similarity score 0.73" |
| **Accuracy** | Exact match on structured data | Ambiguous context window |
| **ERP fit** | Tables map to nodes natively | Flattens tables into chunks |

Wrong context window. Wrong answer.

---

## About This Repo

| File | What |
|------|------|
| `generate_data.js` | Synthetic SharePoint data generator (150 users, 20 projects, 600 docs, 300 tasks) |
| `server.js` | MCP server exposing KG query tools over HTTP |
| `data/` | Generated JSON entities + `triples.csv` for HANA KG import |
| `docs/` | LinkedIn post drafts & flowcharts |

Run locally:

```bash
node generate_data.js   # create data/
node server.js          # start MCP server on :8080
```

Open `http://localhost:8080` for the query UI.

---

## Architecture

```
Joule Agent (MCP Client)
    ↓ tools/call
MCP Server (Node.js — CF)
    ↓ triple-pattern query
SAP HANA Cloud KG (RDF triples)
```

**MCP Tools exposed:**
- `kg_search` — entity lookup by name/ID
- `kg_query` — triple-pattern query (subject / predicate / object)
- `kg_neighbors` — 1-hop graph traversal
- `kg_paths` — BFS pathfinding (≤ 3 hops)
- `kg_stats` — graph summary
- `query_users` / `query_projects` / `query_documents` — filtered entity queries

---

## Tags

`#KnowledgeGraph` `#RDF` `#ModelContextProtocol` `#SAPJoule` `#SAPBTP` `#HANACloudKG` `#S4HANA`
