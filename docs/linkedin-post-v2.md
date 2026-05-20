# LinkedIn Post — Draft

---

I just spent two days doing something I've wanted to do for a while: **building a live Knowledge Graph on SAP HANA Cloud, exposing it via MCP, and querying it naturally from Claude Desktop.**

Here's what that looked like.

**The problem I was trying to solve:**

Enterprise SAP landscapes are sprawling — HANA, S/4HANA, BW, BTP, AI Core, Joule, Datasphere, Analytics Cloud — and nobody has a clean picture of how all these components actually relate to each other. The relationships exist in people's heads, in slide decks, in some Visio diagram that nobody updates.

I wanted a queryable graph. Not a static diagram. Something I could ask: *"how does SAP Joule connect to HANA?"* and get an actual answer with a path.

**The stack:**

→ **SAP HANA Cloud** — stores the KG as two tables: VERTICES (the concepts) and EDGES (their relationships). Simple, clean, SQL-accessible.

→ **BTP MCP Server** (Python + FastMCP) — a lightweight MCP server running on SAP BTP Cloud Foundry. It connects to HANA, exposes the graph via tools and prompt templates, and communicates over the Model Context Protocol.

→ **Claude Desktop** (via local MCP bridge) — connects to the BTP MCP server. Claude can now call tools and prompts directly — graph traversal, path finding, keyword search, all via natural language.

**The three things that made this actually work:**

1. **Prompt templates > tools alone.** The `sap_kg_mermaid` prompt takes a topic name and returns a full Mermaid diagram of the subgraph. Asking Claude to *draw* the graph turned out to be more useful than asking it to *list* the edges.

2. **`sap_kg_path_finder`** — give it two concept names, it runs BFS on the graph, returns the shortest path with edge labels. "How does Joule connect to HANA?" → 1 hop, `integrates_with`. Simple. Exact.

3. **HANA-native graph queries** — stored procedures or SQL window functions on the EDGES table handle the traversal. No external graph database needed. HANA's SQL Engine is sufficient for moderate-size graphs.

**What surprised me:**

The MCP protocol itself is clean. The `sap_materials_ascii` prompt — which renders an ASCII table + bar chart from the MATERIALS table — was a good reminder that MCP prompts aren't just RAG-style retrieval. They're full prompt templates that can query live data, format it, and inject it into a Claude conversation.

The hardest part was not the graph or the MCP server. It was the `dict[str, str]` type annotation on the MCP spec's `GetPromptRequestParams.arguments` field — arguments must be strings, not integers. Took me a few hours to find that one.

**What's next:**

The KG currently has 40 concepts and 39 edges. I'm planning to expand it — SharePoint content, Teams conversations, project metadata — so the graph can answer questions that span business documents and SAP technical components.

If you're working on MCP + SAP integrations, I'd love to compare notes.

#SAPBTP #MCP #ModelContextProtocol #SAPHANA #SAPHANACloud #Claude #EnterpriseAI #KnowledgeGraph

---

**Hook options (pick one for the post header):
- "I connected Claude Desktop to an SAP HANA Knowledge Graph using MCP. Here's what I learned."
- "Two days, one MCP server, and a graph that finally makes the SAP landscape navigable."
- "Querying an SAP Knowledge Graph with natural language — no RAG, no vector DB, just MCP + HANA."

---

**Notes:**
- Target audience: SAP architects, AI/ML engineers working on SAP integrations
- Tone: technical but conversational — not a product announcement
- CTA: comments/discussion, not "reach out to me"
- Length: ~400-500 words body, short paragraphs, no bullet lists
- No hashtags in the body — only at the end
