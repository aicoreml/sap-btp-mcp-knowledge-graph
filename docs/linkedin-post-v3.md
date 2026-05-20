# LinkedIn Post — Draft v3

---

**Built an MCP server on SAP BTP to query a Knowledge Graph stored in SAP HANA Cloud. The results were interesting.**

Two weeks ago I had a graph problem: the relationships between SAP components — Joule, S/4HANA, BW, BTP, AI Core, HANA Cloud, Datasphere, Analytics Cloud — live in slide decks and documentation that nobody updates. The graph exists in people's heads, not in a queryable system.

So I built one. And then exposed it via MCP.

---

**What was built:**

A Knowledge Graph stored in SAP HANA Cloud — two tables, VERTICES and EDGES, holding 40 concepts and 39 relationships. A Python/FastMCP server deployed on SAP BTP Cloud Foundry, connected to HANA Cloud, exposing graph traversal via MCP tools and prompt templates. Claude Desktop connected to the BTP server through a local bridge — a Python script that translates Claude's stdio transport into HTTP/JSON-RPC calls to the cloud endpoint. The server returns JSON responses (configured with `json_response=True`), so the bridge parses JSON-RPC responses directly without SSE streaming. No vector DB. No RAG pipeline. Just SQL, MCP, and a language model.

---

**The three things that made it work:**

1. **Prompt templates, not just tools.** `sap_kg_mermaid` takes a topic name and returns a full Mermaid diagram of the subgraph — asking the model to *draw* the graph proved more useful than asking it to list edges. `sap_kg_path_finder` runs BFS on the graph and returns the shortest path between two concepts with edge labels. Natural language in, visual graph out.

2. **HANA handles the graph traversal.** Stored procedures or SQL window functions on the EDGES table do the heavy lifting. For moderate-size graphs (a few hundred nodes), HANA's SQL engine is entirely sufficient. No separate graph database needed.

3. **The MCP protocol made the integration clean.** After some back-and-forth debugging (more on that below), the server exposes 11 tools and 3 prompt templates over streamable HTTP on BTP. Claude can call them directly — graph queries, ASCII data tables, path analysis — all via natural language.

---

**Why a Knowledge Graph beats RAG for this use case:**

RAG retrieves documents. A Knowledge Graph retrieves *relationships*. When the question is "how does SAP Joule connect to HANA?", a vector search returns paragraphs that might mention both terms. The graph returns: `Joule --[integrates_with]--> HANA`, in one hop, with a citation.

The graph also makes multi-hop reasoning explicit. "What is the path from SAP_AI_Core to SAP_Analytics_Cloud?" — RAG would struggle here. The graph runs BFS and returns the traversal.

Another advantage: the graph is auditable. Every edge has a source. Every relationship is typed. Unlike a black-box embedding that aggregates semantic similarity, the graph can tell you exactly why two concepts are connected.

---

**The hardest part:** The MCP spec defines `GetPromptRequestParams.arguments` as `dict[str, str]`. All prompt arguments must be strings — integers get rejected with a cryptic `-32602 Invalid request parameters` error. Finding that took a few hours. The fix was renaming `min_price` to `minPrice` and changing the parameter type from `float` to `int` so the JSON schema matched.

---

**What's next:**

Expanding the graph with SharePoint content, Teams conversation metadata, and project relationships — so the graph can answer questions spanning both business documents and SAP technical components.

If you're working on MCP + SAP integrations, interested in Knowledge Graph approaches, or have thoughts on HANA as a graph store — comments are open.

#SAPBTP #MCP #ModelContextProtocol #SAPHANA #SAPHANACloud #KnowledgeGraph #EnterpriseAI #RAG #SAPJoule

---

**Meta:**
- Hook: "Built an MCP server on SAP BTP to query a Knowledge Graph stored in SAP HANA Cloud."
- Tone: technical, confident, third-person throughout
- Length: ~450 words body
- No bullet lists in body; use paragraphs
- Hashtags at end only
- No CTA (let comments drive engagement)