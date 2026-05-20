# SAP HANA + MCP Architecture Flowchart

> Last updated: 2026-05-18

---

## Overview: Two Parallel HANA Access Paths

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                              SAP HANA CLOUD                                    │
│   hna1.prod-us10 / ap21.hana.ondemand.com  ·  port 443  ·  SSL                │
│                                                                                │
│   Schemas:                                                                   │
│   ├── MCPUSER  →  MATERIALS, VERTICES, EDGES (Knowledge Graph)               │
│   └── DBADMIN  →  PRODUCTS (40 rows), SALES (50+ rows)                        │
└────────────────────────────────┬────────────────────────┬─────────────────────┘
                                 │                        │
              ┌──────────────────┘                        └──────────────────┐
              ▼                                                            ▼
┌──────────────────────────────┐                          ┌──────────────────────────────┐
│   PATH 1: OpenClaw + Skill   │                          │   PATH 2: Claude Desktop +  │
│                              │                          │           BTP MCP Server     │
│   ~/.openclaw/workspace/     │                          │                              │
│   skills/sap-hana-query-skill │                          │   ~/btp-mcp-server/          │
│                              │                          │                              │
│   Skill: SKILL.md            │                          │   server.py (FastMCP)        │
│   Tool:  dist/index.js       │                          │   └── hana-mcp (BTP CF app)  │
│   AI:    Ollama (local)      │                          │       ↕ REST/SSE             │
│   Creds: .env (DBADMIN)      │                          │   claude_bridge.py (stdio)  │
└──────────────────────────────┘                          └──────────────────────────────┘
              │                                                            │
              ▼                                                            ▼
    OpenClaw Gateway (chat)                                      Claude Desktop (Desktop App)
    Telegram / Web UI                                            stdio transport
```

---

## PATH 1: OpenClaw → sap-hana-query-skill → HANA (DBADMIN)

### Component Map

```
User (Telegram/Chat)
        │
        ▼
OpenClaw Gateway  (launchd: ai.openclaw.gateway, PID 86071)
        │
        ▼  /hana or "show products..." or any HANA keyword
sap-hana-query-skill/SKILL.md  activated
        │
        ▼  exec: sap-hana-tool "query"
dist/index.js  (Node.js, TypeScript compiled)
        │
        ├──▶ Fetch schema from HANA (SYS.TABLE_COLUMNS)
        │         encrypt=true, sslValidateCertificate=false
        │
        ├──▶ Call Ollama  http://localhost:11434
        │         model: minimax-m2.5:cloud
        │         prompt: question + schema → SQL
        │
        └──▶ Execute SQL on SAP HANA Cloud
                  host: 588fc59b-fcd3-47fd-...hna1.prod-us10.hanacloud.ondemand.com
                  user: DBADMIN
                  tables: PRODUCTS, SALES
                  encrypt+ssl
        │
        ▼
Format: markdown table (≤10 rows) or summary (>10 rows)
        │
        ▼
Response to user
```

### Credentials (from `~/.openclaw/.env`)

```bash
HANA_HOST=588fc59b-fcd3-47fd-adc1-826890c64a05.hna1.prod-us10.hanacloud.ondemand.com
HANA_PORT=443
HANA_USER=DBADMIN
HANA_PASSWORD=<Winter01>
```

### Available Tables (DBADMIN schema)

| Table | Rows | Use for |
|---|---|---|
| `PRODUCTS` | 40 | Products, inventory, pricing, suppliers |
| `SALES` | 50+ | Transactions Dec 2025–Feb 2026, revenue, regions |

### Key Files

```
~/.openclaw/workspace/skills/sap-hana-query-skill/
├── SKILL.md              ← skill trigger definition
├── dist/index.js         ← compiled CLI tool (sap-hana-tool)
├── src/index.ts          ← source (TypeScript)
├── test-hana.js          ← direct HANA connection test
└── FLOWCHART.md          ← this file
```

### Commands

```bash
# Direct test
export HANA_HOST=... HANA_PORT=443 HANA_USER=DBADMIN HANA_PASSWORD=Winter01
sap-hana-tool "show top 5 products by revenue"

# Skill shortcut
/hana show top 5 products by revenue
/hana list products under 200 EUR
```

---

## PATH 2: Claude Desktop → BTP MCP Server (hana-mcp on CF)

### Component Map

```
Claude Desktop (desktop app)
    stdio (JSON-RPC)
        │
        ▼
~/btp-mcp-server/claude_bridge.py   (PID 80996)
    stdio-to-HTTP bridge
    ↕ httpx.Client  →  https://hana-mcp.cfapps.ap21.hana.ondemand.com/mcp
        │
        ▼
hana-mcp  (FastMCP, deployed on SAP BTP Cloud Foundry)
    region: ap21  (Japan)
    path: /mcp  (StreamableHTTP, stateless)
    ↕ hdbcli (Python)  →  HANA Cloud (MCPUSER schema)
    ↕ starlette  →  REST endpoints
        │
        ▼
HANA Cloud  (MCPUSER schema)
    tables: MATERIALS, VERTICES, EDGES
```

### MCP Tools (from server.py)

| Tool | Purpose |
|---|---|
| `hana_materials` | List MATERIALS table (limit N) |
| `hana_materials_by_type` | Search MATERIALS by description |
| `hana_sales_stats` | COUNT + SUM(PRICE) from MATERIALS |
| `hana_sales_chart` | Group by category for charting |
| `hana_kg_vertices` | List Knowledge Graph vertices |
| `hana_kg_edges` | List Knowledge Graph edges |
| `hana_kg_neighbors` | 1-hop neighbours of a vertex |
| `hana_kg_paths` | BFS path finding (max 3 hops) |
| `hana_kg_stats` | Vertex + edge counts |
| `hana_kg_search` | Substring search vertices |
| `hana_kg_degree` | Connection count for vertex |
| `hana_kg_subgraph` | N-hop neighbourhood subgraph |
| `hana_kg_explain_path` | Human-readable path explanation |

### REST Endpoints (via custom_route)

| Endpoint | Method | Purpose |
|---|---|---|
| `/sales` | GET | MATERIALS table (limit 10) |
| `/sales/stats` | GET | COUNT + SUM(PRICE_EURO) |
| `/sales/chart` | GET | GROUP BY DESCRIPTION |
| `/sales/{matnr}` | GET | Single material by MATNR |
| `/health` | GET | Health check |

### Prompts (FastMCP prompts)

| Prompt | Purpose |
|---|---|
| `sap_kg_mermaid` | Generate Mermaid KG diagram |
| `sap_materials_ascii` | ASCII table + bar chart for materials |
| `sap_kg_path_finder` | Interactive path explorer |

### Key Files

```
~/btp-mcp-server/
├── server.py           ← FastMCP server (deployed to BTP CF)
├── claude_bridge.py    ← stdio→HTTP bridge (runs locally, PID 80996)
├── create_mcp_user.sql ← HANA objects (MATERIALS, KG schema)
├── setup_mcpuser.py    ← Schema setup script
└── manifest.yml        ← BTP CF deployment manifest
```

### Credentials (MCPUSER schema)

```sql
-- MATERIALS table
MATNR, DESCRIPTION, PRICE_EURO, STOCK

-- Knowledge Graph
VERTICES (ID, NAME)
EDGES (ID, PREDICATE, SOURCE, TARGET)

-- Creds (from VCAP_SERVICES on CF, env vars locally)
HANA_USER=mcpuser
HANA_PASSWORD=McpPass123
HANA_SCHEMA=MCPUSER
```

---

## Decision Flow: Which Path to Use?

```
                   User Request
                        │
                        ▼
           ┌────────────────────────┐
           │ OpenClaw?             │
           │ (Telegram/Web UI)     │
           └───────────┬────────────┘
                       │
              ┌────────┴────────┐
              │                 │
             YES               NO
              │                 │
              ▼                 ▼
    ┌─────────────────┐  ┌─────────────────┐
    │ PATH 1          │  │ Claude Desktop? │
    │ OpenClaw skill  │  │                 │
    │ /hana command   │  └────────┬────────┘
    │ or natural      │           │
    │ language        │    ┌─────┴─────┐
    │                 │   YES         NO
    │ Tables:        │    │           │
    │ PRODUCTS,      │    ▼           ▼
    │ SALES          │ ┌────────┐ ┌─────────────┐
    │                │ │ PATH 2 │ │ Other tools │
    │ DBADMIN creds  │ │ BTP    │ │ (general    │
    └───────┬────────┘ │ MCP    │ │  chat)      │
            │         └────────┘ └─────────────┘
            ▼
    ┌─────────────────┐
    │ollama generates │
    │SQL → HANA exec │
    │→ markdown table│
    └─────────────────┘
```

---

## Architecture Summary

```
                    ┌──────────────────────────────────┐
                    │      SAP HANA Cloud (HANA DB)     │
                    │                                  │
                    │  ┌──────────┐  ┌──────────────┐  │
                    │  │ DBADMIN  │  │   MCPUSER    │  │
                    │  │ PRODUCTS │  │ MATERIALS    │  │
                    │  │ SALES    │  │ VERTICES     │  │
                    │  │          │  │ EDGES        │  │
                    │  └────┬─────┘  └──────┬───────┘  │
                    └───────┼───────────────┼──────────┘
                            │               │
              PATH 1 (DBADMIN)        PATH 2 (MCPUSER)
                            │               │
                    ┌───────▼───────┐ ┌─────▼──────────┐
                    │ Node.js CLI    │ │ Python FastMCP │
                    │ dist/index.js  │ │ server.py      │
                    │ + Ollama LLM   │ │ hdbcli conn    │
                    └───────┬───────┘ └─────┬──────────┘
                            │               │
                    ┌───────▼────────┐ ┌─────▼──────────┐
                    │ OpenClaw       │ │ Claude Desktop │
                    │ Gateway        │ │ + claude_     │
                    │ /hana skill   │ │ bridge.py     │
                    └───────────────┘ └────────────────┘

Active processes:
  PID 80996: claude_bridge.py (Path 2 stdio bridge)
  PID 12012: mcp-server-filesystem
  PID 11993: mcp-server-github
  PID 11971: kreuzberg mcp
```

---

## Quick Reference

```bash
# Path 1: OpenClaw HANA query
/hana top 10 products by revenue

# Path 2: Direct REST call (BTP MCP server)
/health  →  https://hana-mcp.cfapps.ap21.hana.ondemand.com/health
/sales   →  GET materials

# Check active MCP sessions
ps aux | grep -E "hana|mcp|bridge" | grep -v grep

# BTP MCP server logs (if deployed)
cf logs hana-mcp --recent
```