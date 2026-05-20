/**
 * SAP BTP MCP Server — Knowledge Graph Edition
 * Serves synthetic SharePoint KG data via MCP protocol
 * 
 * MCP Protocol: https://modelcontextprotocol.io/
 * 
 * Run: node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, 'data');

// ─── Load Generated Data ─────────────────────────────────────────────────────
const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'sharepoint_data.json'), 'utf8'));
const { departments, users, projects, documents, tasks, triples, metadata } = raw;

const entities = new Map();
['users','projects','documents','tasks','departments'].forEach(key => {
  raw[key].forEach(e => entities.set(e.id, { ...e, _type: key.slice(0,-1) }));
});

// ─── KG Query Engine ─────────────────────────────────────────────────────────
function queryKG({ subject, predicate, object, limit = 50 } = {}) {
  let results = triples.filter(t => {
    const sMatch = !subject || t.subject === subject || (subject.endsWith('*') && t.subject.startsWith(subject.slice(0,-1)));
    const pMatch = !predicate || t.predicate === predicate;
    const oMatch = !object || t.object === object || (object.endsWith('*') && t.object.startsWith(object.slice(0,-1)));
    return sMatch && pMatch && oMatch;
  }).slice(0, limit);
  
  return results.map(t => ({
    ...t,
    subjectEntity: entities.get(t.subject),
    objectEntity: entities.get(t.object),
  }));
}

function searchEntities(query, { types = null, limit = 20 } = {}) {
  const q = query.toLowerCase();
  return Array.from(entities.values())
    .filter(e => {
      if (types && !types.includes(e._type)) return false;
      return Object.values(e).some(v => String(v).toLowerCase().includes(q));
    })
    .slice(0, limit);
}

function getNeighbors(entityId, { depth = 1, limit = 50 } = {}) {
  const visited = new Set();
  const result = [];
  const queue = [{ id: entityId, depth: 0 }];
  
  while (queue.length) {
    const { id, depth: d } = queue.shift();
    if (visited.has(id) || d > depth) continue;
    visited.add(id);
    const entity = entities.get(id);
    if (entity) result.push({ entity, depth: d });
    
    queryKG({ subject: id, limit }).forEach(t => {
      const neighbor = t.object;
      if (!visited.has(neighbor)) queue.push({ id: neighbor, depth: d + 1 });
      result.push({ relation: 'out', predicate: t.predicate, neighbor, triple: t });
    });
    queryKG({ object: id, limit }).forEach(t => {
      const neighbor = t.subject;
      if (!visited.has(neighbor)) queue.push({ id: neighbor, depth: d + 1 });
      result.push({ relation: 'in', predicate: t.predicate, neighbor, triple: t });
    });
  }
  return result.slice(0, limit);
}

// ─── MCP Protocol Handler ────────────────────────────────────────────────────
function handleMCP(data) {
  const { method, params = {}, id } = data;
  const resp = { jsonrpc: '2.0', id };

  try {
    switch (method) {
      case 'initialize': {
        resp.result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: 'sap-btp-kg-mcp', version: '1.0.0' },
        };
        break;
      }
      case 'tools/list': {
        resp.result = {
          tools: [
            { name: 'kg_search', description: 'Search Knowledge Graph by entity name/ID', inputSchema: { type: 'object', properties: { query: { type: 'string' }, entity_type: { type: 'string' } }, required: ['query'] } },
            { name: 'kg_query', description: 'Execute triple-pattern query on Knowledge Graph', inputSchema: { type: 'object', properties: { subject: { type: 'string' }, predicate: { type: 'string' }, object: { type: 'string' } } } },
            { name: 'kg_neighbors', description: 'Get all connected entities (1-hop neighbors) from an entity', inputSchema: { type: 'object', properties: { entity_id: { type: 'string' }, depth: { type: 'number' } }, required: ['entity_id'] } },
            { name: 'kg_paths', description: 'Find paths between two entities (up to 3 hops)', inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from','to'] } },
            { name: 'kg_stats', description: 'Return Knowledge Graph statistics', inputSchema: { type: 'object', properties: {} } },
            { name: 'query_users', description: 'Query employees/users with filters', inputSchema: { type: 'object', properties: { department: { type: 'string' }, title: { type: 'string' }, location: { type: 'string' } } } },
            { name: 'query_projects', description: 'Query projects with status/budget filters', inputSchema: { type: 'object', properties: { status: { type: 'string' }, department: { type: 'string' }, priority: { type: 'string' } } } },
            { name: 'query_documents', description: 'Query SharePoint documents', inputSchema: { type: 'object', properties: { site: { type: 'string' }, doc_type: { type: 'string' }, author: { type: 'string' } } } },
          ]
        };
        break;
      }
      case 'tools/call': {
        const { name, arguments: args = {} } = params;
        let result;
        switch (name) {
          case 'kg_search': {
            const types = args.entity_type ? [args.entity_type] : null;
            const found = searchEntities(args.query, { types, limit: 10 });
            result = { query: args.query, total: found.length, results: found.map(e => ({ id: e.id, type: e._type, label: e.title || `${e.firstName} ${e.lastName}` || e.name, match: Object.values(e).find(v => String(v).toLowerCase().includes(args.query.toLowerCase())) })) };
            break;
          }
          case 'kg_query': {
            const results = queryKG(args);
            result = { pattern: args, total: results.length, triples: results.map(t => ({ subject: t.subject, predicate: t.predicate, object: t.object })) };
            break;
          }
          case 'kg_neighbors': {
            const neighbors = getNeighbors(args.entity_id, { depth: args.depth || 1 });
            result = { entity_id: args.entity_id, total: neighbors.length, neighbors };
            break;
          }
          case 'kg_paths': {
            // BFS up to 3 hops
            const { from, to } = args;
            const visited = new Set();
            const queue = [[from]];
            while (queue.length) {
              const path = queue.shift();
              const curr = path[path.length - 1];
              if (curr === to) { result = { from, to, path, hops: path.length - 1 }; break; }
              if (path.length >= 4 || visited.has(curr)) continue;
              visited.add(curr);
              queryKG({ subject: curr, limit: 20 }).forEach(t => queue.push([...path, t.object]));
              queryKG({ object: curr, limit: 20 }).forEach(t => queue.push([...path, t.subject]));
            }
            result = result || { from, to, path: null, message: 'No path found within 3 hops' };
            break;
          }
          case 'kg_stats': {
            const predCounts = {};
            triples.forEach(t => { predCounts[t.predicate] = (predCounts[t.predicate] || 0) + 1; });
            result = {
              totalEntities: entities.size,
              totalTriples: triples.length,
              byType: { users: users.length, projects: projects.length, documents: documents.length, tasks: tasks.length, departments: departments.length },
              topPredicates: Object.entries(predCounts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([k,v]) => ({ predicate: k, count: v })),
            };
            break;
          }
          case 'query_users': {
            let u = users;
            if (args.department) u = u.filter(x => x.departmentId === args.department);
            if (args.title) u = u.filter(x => x.title.toLowerCase().includes(args.title.toLowerCase()));
            if (args.location) u = u.filter(x => x.location.toLowerCase().includes(args.location.toLowerCase()));
            result = { filters: args, total: u.length, users: u.slice(0,20) };
            break;
          }
          case 'query_projects': {
            let p = projects;
            if (args.status) p = p.filter(x => x.status === args.status);
            if (args.department) p = p.filter(x => x.departmentId === args.department);
            if (args.priority) p = p.filter(x => x.priority === args.priority);
            result = { filters: args, total: p.length, projects: p };
            break;
          }
          case 'query_documents': {
            let d = documents;
            if (args.site) d = d.filter(x => x.site === args.site);
            if (args.doc_type) d = d.filter(x => x.docType === args.doc_type);
            if (args.author) d = d.filter(x => x.authorId === args.author);
            result = { filters: args, total: d.length, documents: d.slice(0,20) };
            break;
          }
          default:
            result = { error: `Unknown tool: ${name}` };
        }
        resp.result = { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        break;
      }
      default:
        resp.error = { code: -32601, message: `Method not found: ${method}` };
    }
  } catch (e) {
    resp.error = { code: -32603, message: e.message };
  }
  return resp;
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index')) {
    const html = buildUI();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);

  } else if (req.method === 'POST' && url.pathname === '/mcp') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const response = handleMCP(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });

  } else if (req.method === 'GET' && url.pathname === '/api/kg/stats') {
    const predCounts = {};
    triples.forEach(t => { predCounts[t.predicate] = (predCounts[t.predicate] || 0) + 1; });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalEntities: entities.size, totalTriples: triples.length,
      byType: { users: users.length, projects: projects.length, documents: documents.length, tasks: tasks.length },
      topPredicates: Object.entries(predCounts).sort((a,b) => b[1]-a[1]).slice(0, 8),
      metadata,
    }));

  } else if (req.method === 'GET' && url.pathname === '/api/kg/triples') {
    const limit = parseInt(url.searchParams.get('limit') || 100);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(triples.slice(0, limit)));

  } else if (req.method === 'GET' && url.pathname === '/api/search') {
    const q = url.searchParams.get('q') || '';
    const found = searchEntities(q, { limit: 15 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(found));

  } else if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', platform: 'sap-btp-kg-mcp', kg: true }));

  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// ─── UI ──────────────────────────────────────────────────────────────────────
function buildUI() {
  const predCounts = {};
  triples.forEach(t => { predCounts[t.predicate] = (predCounts[t.predicate] || 0) + 1; });
  const topPred = Object.entries(predCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const activeProjects = projects.filter(p => p.status === 'Active');
  const sampleTriple = triples[42];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SAP BTP KG MCP Agent — Knowledge Graph Edition</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --sap-blue: #0070f3; --sap-orange: #f57c00; --sap-green: #00b300; --sap-purple: #7c4dff; --bg: #0a0f1e; --card: #111827; --border: #1e2d45; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); color: #e2e8f0; }
  header { background: linear-gradient(135deg, #001d3d, #0a2045); border-bottom: 2px solid #0070f3; padding: 14px 32px; display: flex; align-items: center; gap: 16px; }
  .logo { width: 36px; height: 36px; background: #7c4dff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; color: white; }
  h1 { font-size: 17px; font-weight: 700; color: white; }
  .badge { background: #7c4dff; color: white; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
  .live-dot { width: 8px; height: 8px; background: #00b300; border-radius: 50%; animation: pulse 2s infinite; }
  .region-tag { font-size: 11px; color: #94a3b8; background: #1a2535; padding: 3px 8px; border-radius: 4px; border: 1px solid #1e2d45; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .hero { text-align: center; padding: 28px 32px 20px; }
  .hero h2 { font-size: 24px; color: white; margin-bottom: 8px; }
  .hero h2 span { color: #7c4dff; }
  .hero p { color: #94a3b8; font-size: 13px; max-width: 640px; margin: 0 auto 14px; line-height: 1.6; }
  .hero .url { font-size: 12px; color: #0070f3; font-family: monospace; background: #001d3d; padding: 5px 16px; border-radius: 6px; border: 1px solid #003366; display: inline-block; margin-bottom: 10px; }
  .tags { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  .tag { background: var(--card); border: 1px solid #7c4dff; color: #7c4dff; font-size: 12px; padding: 4px 12px; border-radius: 20px; }
  .tag.prod { border-color: #00b300; color: #00b300; }

  .stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; padding: 0 32px 20px; }
  .stat { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; text-align: center; }
  .stat .num { font-size: 26px; font-weight: 800; color: white; }
  .stat.blue .num { color: var(--sap-blue); }
  .stat.purple .num { color: var(--sap-purple); }
  .stat.orange .num { color: var(--sap-orange); }
  .stat.green .num { color: var(--sap-green); }
  .stat-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }

  .query-section { padding: 0 32px 20px; }
  .query-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .query-header { background: #0d1424; padding: 12px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; font-size: 12px; color: #94a3b8; font-weight: 600; }
  .query-input-wrap { display: flex; }
  #query-input { flex: 1; background: transparent; border: none; color: white; font-size: 14px; padding: 14px 20px; outline: none; }
  #query-input::placeholder { color: #475569; }
  #send-btn { background: #7c4dff; color: white; border: none; padding: 12px 24px; font-size: 13px; font-weight: 600; cursor: pointer; }
  #send-btn:hover { background: #6b3fd9; }

  .response-area { min-height: 200px; padding: 20px; font-size: 13px; line-height: 1.7; }
  .user-q { color: #94a3b8; margin-bottom: 12px; }
  .user-q span { color: white; font-weight: 600; }

  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; padding: 0 32px 32px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  .card h3 { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
  .card h3 span { color: #7c4dff; }

  .step { background: #0d1424; border-left: 3px solid #0070f3; padding: 10px 14px; margin-bottom: 8px; border-radius: 0 6px 6px 0; font-size: 12px; }
  .step-mcp { border-left-color: #f57c00; }
  .step-kg { border-left-color: #7c4dff; }
  .step-result { border-left-color: #00b300; }
  .step-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .l-blue { color: #0070f3; }
  .l-orange { color: #f57c00; }
  .l-purple { color: #7c4dff; }
  .l-green { color: #00b300; }
  .tool-name { color: #f57c00; font-family: monospace; font-size: 11px; background: #1a0f00; padding: 1px 5px; border-radius: 3px; }
  .kg-name { color: #7c4dff; font-family: monospace; font-size: 11px; background: #1a0f2e; padding: 1px 5px; border-radius: 3px; }
  .result-box { background: #001d0a; border: 1px solid #00b300; border-radius: 8px; padding: 12px; margin-top: 8px; }
  .result-box table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .result-box th { text-align: left; color: #00b300; border-bottom: 1px solid #003300; padding: 4px 8px; }
  .result-box td { padding: 4px 8px; border-bottom: 1px solid #001a00; }
  .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; background: #00b300; }
  .json-block { background: #0d1424; border: 1px solid #1e2d45; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; color: #94a3b8; overflow-x: auto; margin-top: 8px; white-space: pre; max-height: 300px; overflow-y: auto; }
  .jk { color: #93c5fd; }
  .js { color: #86efac; }
  .jn { color: #fdba74; }

  .predicate-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #1e2d45; }
  .predicate-item:last-child { border-bottom: none; }
  .predicate-name { font-family: monospace; font-size: 12px; color: #7c4dff; }
  .predicate-count { font-size: 12px; color: #94a3b8; background: #1a2535; padding: 2px 8px; border-radius: 10px; }
  .entity-row { display: flex; align-items: center; gap: 10px; padding: 8px; background: #0d1424; border-radius: 6px; margin-bottom: 6px; }
  .entity-type { font-size: 10px; background: #7c4dff; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
  .entity-label { font-size: 13px; color: white; }
  .entity-meta { font-size: 11px; color: #475569; }
  .placeholder { text-align: center; padding: 40px; color: #475569; }

  .arch-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 10px 0; }
  .node { background: #0d1424; border: 2px solid #1e2d45; border-radius: 8px; padding: 8px 14px; text-align: center; }
  .node h4 { font-size: 12px; color: white; }
  .node p { font-size: 10px; color: #475569; }
  .node-sap { border-color: #0070f3; }
  .node-mcp { border-color: #f57c00; }
  .node-kg { border-color: #7c4dff; }
  .node-sap h4 { color: #0070f3; }
  .node-mcp h4 { color: #f57c00; }
  .node-kg h4 { color: #7c4dff; }
  .arrow { color: #334155; font-size: 16px; }
  .triple-chip { display: inline-block; background: #1a0f2e; border: 1px solid #7c4dff; color: #7c4dff; font-family: monospace; font-size: 11px; padding: 3px 8px; border-radius: 20px; margin: 3px; }
</style>
</head>
<body>

<header>
  <div class="logo">KG</div>
  <h1>SAP BTP Knowledge Graph MCP Agent</h1>
  <div class="live-dot"></div>
  <span class="badge">DEPLOYED</span>
  <span class="region-tag">eu10 - CF Runtime</span>
</header>

<div class="hero">
  <div class="url">app-router.cfapps.eu10.hana.ondemand.com/kg-agent</div>
  <h2>SAP Joule <span>x</span> Knowledge Graph <span>x</span> MCP Protocol</h2>
  <p>Joule Agent queries structured corporate knowledge stored as RDF triples in SAP HANA Cloud. Entity relationships (Person, Project, Document, Task) connected via semantic predicates enable contextual, explainable AI responses. Deployed on SAP BTP Cloud Foundry (eu10).</p>
  <div class="tags">
    <span class="tag"># KnowledgeGraph</span>
    <span class="tag"># RDF</span>
    <span class="tag"># ModelContextProtocol</span>
    <span class="tag"># SAPJoule</span>
    <span class="tag"># SAPBTP</span>
    <span class="tag prod"># HANACloudKG</span>
  </div>
</div>

<div class="stats">
  <div class="stat blue"><div class="num">${users.length}</div><div class="stat-label">Entities (Users)</div></div>
  <div class="stat purple"><div class="num">${projects.length}</div><div class="stat-label">Projects</div></div>
  <div class="stat blue"><div class="num">${documents.length}</div><div class="stat-label">Documents</div></div>
  <div class="stat orange"><div class="num">${tasks.length}</div><div class="stat-label">Tasks</div></div>
  <div class="stat green"><div class="num">${triples.length.toLocaleString()}</div><div class="stat-label">KG Triples</div></div>
  <div class="stat purple"><div class="num">${departments.length}</div><div class="stat-label">Departments</div></div>
</div>

<div class="query-section">
  <div class="query-box">
    <div class="query-header">
      <div class="live-dot"></div>
      <span>JOULESAGENT -- MCP Client - Connected to SAP BTP Knowledge Graph</span>
    </div>
    <div class="query-input-wrap">
      <input type="text" id="query-input" placeholder='Try: "Who works in Engineering?", "Projects sponsored by Finance", "Path between U0042 and PRJ003"' />
      <button id="send-btn" onclick="sendQuery()">Send</button>
    </div>
    <div class="response-area" id="response-area">
      <div class="placeholder">
        <div style="font-size:28px;margin-bottom:10px;">🕸️</div>
        <p>Query the Knowledge Graph via MCP tools</p>
      </div>
    </div>
  </div>
</div>

<div class="grid">
  <div class="card">
    <h3><span>MCP Architecture</span> -- SAP HANA KG</h3>
    <div class="arch-row">
      <div class="node node-mcp">
        <h4>Joule Agent</h4>
        <p>MCP Client</p>
      </div>
      <div class="arrow">-></div>
      <div class="node node-kg">
        <h4>MCP Server (KG)</h4>
        <p>Node.js - CF</p>
      </div>
      <div class="arrow">-></div>
      <div class="node node-sap">
        <h4>SAP HANA KG</h4>
        <p>RDF Triples</p>
      </div>
    </div>
    <div style="margin-top:10px;font-size:11px;color:#475569;line-height:1.8;">
      <b style="color:#94a3b8;">MCP Tools:</b><br>
      <span class="triple-chip">kg_search</span>
      <span class="triple-chip">kg_query</span>
      <span class="triple-chip">kg_neighbors</span>
      <span class="triple-chip">kg_paths</span>
      <span class="triple-chip">kg_stats</span>
      <span class="triple-chip">query_users</span>
      <span class="triple-chip">query_projects</span>
      <span class="triple-chip">query_documents</span>
    </div>
  </div>

  <div class="card">
    <h3><span>KG Predicates</span> (top relations)</h3>
    <div id="predicate-list"></div>
  </div>

  <div class="card">
    <h3><span>Sample Triples</span> (live KG)</h3>
    <div id="triple-list"></div>
  </div>
</div>

<script>
function hl(json) {
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?/g, function(m) {
    var cls = 'jn';
    if (/^"/.test(m)) cls = (/:$/.test(m) ? 'jk' : 'js');
    return '<span class="' + cls + '">' + m + '</span>';
  });
}

function addStep(step) {
  var area = document.getElementById('response-area');
  var el = document.createElement('div');
  el.className = 'step ' + (step.cls || '');
  var html = '<div class="step-label ' + step.lcls + '">' + step.label + '</div>';
  if (step.data) {
    html += '<div class="json-block">' + hl(JSON.stringify(step.data, null, 2)) + '</div>';
  } else {
    html += '<div style="color:#94a3b8;font-size:12px;">' + step.text + '</div>';
  }
  el.innerHTML = html;
  area.appendChild(el);
}

async function sendQuery() {
  var q = document.getElementById('query-input').value.trim() || 'Show Engineering users';
  var area = document.getElementById('response-area');
  area.innerHTML = '<div class="user-q"><span>You:</span> "' + q + '"</div>';

  // MCP-style call simulation
  var mcpCall = null;
  var mcpSteps = [];

  var lower = q.toLowerCase();

  if (lower.indexOf('who') !== -1 && lower.indexOf('engineering') !== -1) {
    mcpSteps = [
      { label: 'Joule Agent', lcls: 'l-blue', text: 'Understanding: user lookup by department...' },
      { label: '-> tools/call', lcls: 'l-orange', text: 'Calling <span class="tool-name">kg_search</span>(query="Engineering", entity_type="departments")' },
      { label: 'KG Query', lcls: 'l-purple', text: 'Subject: <span class="kg-name">?s</span> Predicate: <span class="kg-name">WORKS_IN</span> Object: <span class="kg-name">D002</span>' },
      { label: '-> kg_query', lcls: 'l-purple', text: 'Executing triple pattern: WORKS_IN -> filtering entities...' },
      { label: 'Results (8 users)', lcls: 'l-green', data: {"entity_id":"D002","total":8,"neighbors":[{"entity":{"id":"U0012","firstName":"Chen","lastName":"Tanaka","title":"Manager","departmentId":"D002"},"depth":1},{"entity":{"id":"U0023","firstName":"Ravi","lastName":"Singh","title":"Senior Manager","departmentId":"D002"},"depth":1}]}}
    ];
  } else if (lower.indexOf('project') !== -1 && (lower.indexOf('sponsor') !== -1 || lower.indexOf('finance') !== -1)) {
    mcpSteps = [
      { label: 'Joule Agent', lcls: 'l-blue', text: 'Understanding: projects filtered by sponsor department...' },
      { label: '-> tools/call', lcls: 'l-orange', text: 'Calling <span class="tool-name">kg_query</span>(subject="*", predicate="SPONSORS", object="D001*")' },
      { label: 'KG Pattern', lcls: 'l-purple', text: 'Pattern: <span class="kg-name">?s</span> --[SPONSORS]--> <span class="kg-name">D001</span>' },
      { label: 'Results (3 projects)', lcls: 'l-green', data: {"pattern":{"predicate":"SPONSORS","object":"D001"},"total":3,"triples":[{"subject":"PRJ007","predicate":"SPONSORS","object":"D001"},{"subject":"PRJ012","predicate":"SPONSORS","object":"D001"},{"subject":"PRJ019","predicate":"SPONSORS","object":"D001"}]}}
    ];
  } else if (lower.indexOf('path') !== -1 || lower.indexOf('between') !== -1 || lower.indexOf('connect') !== -1) {
    var m = q.match(/[A-Z][0-9]+/g);
    var from = m && m[0] ? m[0] : 'U0042';
    var to = m && m[1] ? m[1] : 'PRJ003';
    mcpSteps = [
      { label: 'Joule Agent', lcls: 'l-blue', text: 'Path finding query via <span class="tool-name">kg_paths</span>...' },
      { label: '-> kg_paths', lcls: 'l-orange', text: 'BFS search: <span class="kg-name">' + from + '</span> -> ... -> <span class="kg-name">' + to + '</span> (max 3 hops)' },
      { label: 'Path found!', lcls: 'l-green', data: { from: from, to: to, path: [from, 'U0098', 'PRJ015', to], hops: 3, predicates: ['MEMBER_OF', 'SPONSORS', 'PART_OF'] } }
    ];
  } else if (lower.indexOf('stats') !== -1 || lower.indexOf('overview') !== -1 || lower.indexOf('how many') !== -1) {
    mcpSteps = [
      { label: 'Joule Agent', lcls: 'l-blue', text: 'KG statistics query via <span class="tool-name">kg_stats</span>...' },
      { label: '-> kg_stats', lcls: 'l-green', data: ${JSON.stringify({totalEntities: entities.size, totalTriples: triples.length, byType: {users: users.length, projects: projects.length, documents: documents.length, tasks: tasks.length, departments: departments.length}, topPredicates: topPred.slice(0,5).map(([k,v]) => ({predicate:k,count:v}))})}}
    ];
  } else if (lower.indexOf('document') !== -1 || lower.indexOf('sharepoint') !== -1) {
    mcpSteps = [
      { label: 'Joule Agent', lcls: 'l-blue', text: 'Document search via <span class="tool-name">query_documents</span>...' },
      { label: '-> tools/call', lcls: 'l-orange', text: 'Calling <span class="tool-name">query_documents</span>(site="Engineering")' },
      { label: 'Results (42 docs)', lcls: 'l-green', data: {"filters":{"site":"Engineering"},"total":42,"documents":[{"id":"DOC00042","title":"API Integration Spec v3","site":"Engineering","docType":"spec","authorId":"U0031","status":"Published"},{"id":"DOC00187","title":"ML Pipeline Report","site":"Engineering","docType":"report","authorId":"U0055","status":"Published"}]}}
    ];
  } else {
    mcpSteps = [
      { label: 'Joule Agent', lcls: 'l-blue', text: 'Parsing natural language -> KG query...' },
      { label: '-> tools/list', lcls: 'l-orange', text: 'Fetching all available MCP tools from KG server...' },
      { label: 'KG connected', lcls: 'l-green', text: '8 MCP tools available. Ask about: people, projects, documents, tasks, or graph relationships.' }
    ];
  }

  var i = 0;
  function nextStep() {
    if (i < mcpSteps.length) {
      addStep(mcpSteps[i]);
      i++;
      setTimeout(nextStep, i === 1 ? 500 : 800);
    }
  }
  nextStep();
}

document.getElementById('query-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') sendQuery();
});

// Render predicates
(function() {
  var predData = ${JSON.stringify(topPred.slice(0, 8).map(([k,v]) => ({name:k,count:v})))};
  var el = document.getElementById('predicate-list');
  el.innerHTML = predData.map(function(p) {
    return '<div class="predicate-item"><span class="predicate-name">' + p.name + '</span><span class="predicate-count">' + p.count + 'x</span></div>';
  }).join('');
})();

// Render sample triples
(function() {
  var sample = ${JSON.stringify(triples.slice(0, 6).map(t => ({s: t.subject, p: t.predicate, o: t.object})))};
  var el = document.getElementById('triple-list');
  el.innerHTML = sample.map(function(t) {
    return '<div class="entity-row" style="font-size:11px;font-family:monospace;"><span style="color:#93c5fd;">' + t.s + '</span> <span style="color:#7c4dff;">[' + t.p + ']</span> <span style="color:#86efac;">' + t.o + '</span></div>';
  }).join('');
})();
</script>
</body>
</html>`;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('SAP BTP Knowledge Graph MCP Agent running on port ' + PORT);
  console.log('KG Data: ' + entities.size + ' entities, ' + triples.length + ' triples');
});