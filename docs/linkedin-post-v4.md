# LinkedIn Post -- Draft v4

---

**Built a Knowledge Graph in SAP HANA Cloud and exposed it via an MCP server on SAP BTP. Screenshots say more than I can:**

*(see below -- the graph, the MCP tools, the prompt response)*

The idea: enterprise SAP landscapes are sprawling -- Joule, S/4HANA, BW, BTP, AI Core, HANA Cloud, Datasphere, Analytics Cloud -- and nobody has a clean picture of how all these components actually relate to each other. The relationships live in slide decks nobody updates, or in people's heads.

The solution: a simple two-table Knowledge Graph in HANA Cloud (VERTICES + EDGES), exposed via an MCP server deployed on BTP. Claude Desktop connects to it through a lightweight bridge. Ask a question, get a graph.

**Why Knowledge Graph over RAG:**

RAG retrieves documents. A graph retrieves relationships. When the question is *"how does Joule connect to HANA?"* -- RAG returns paragraphs that might mention both. The graph returns: `Joule --[integrates_with]--> HANA`, one hop, with a source.

The graph also handles multi-hop reasoning cleanly: *"What is the path from SAP AI Core to SAP Analytics Cloud?"* -- a BFS traversal answers that. Every edge is typed, every relationship auditable. No black-box embedding.

**What it took:**

A graph workspace in SAP HANA Cloud. Two tables -- VERTICES (ID, NAME) and EDGES (SOURCE, TARGET, PREDICATE) -- with referential integrity between them. A Python/FastMCP server on BTP. A bridge connecting Claude Desktop. Two days of work.

40 concepts. 39 edges. Queryable from natural language.

Next: expand with SharePoint content, Teams metadata, project relationships -- so the graph spans business documents and SAP technical components.

#SAPBTP #MCP #ModelContextProtocol #SAPHANA #SAPHANACloud #KnowledgeGraph #EnterpriseAI #RAG

---

**Hook:** "Built a Knowledge Graph in SAP HANA Cloud and connected it to Claude Desktop via MCP. Here's what happened."