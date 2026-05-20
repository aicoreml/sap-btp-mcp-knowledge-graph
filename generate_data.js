/**
 * Synthetic SharePoint Business Data Generator
 * Generates realistic corporate data for KG demo
 * Run: node generate_data.js
 */

const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const OUT = path.join(__dirname, 'data');
fs.mkdirSync(OUT, { recursive: true });

// ─── Seed Data ────────────────────────────────────────────────────────────────
const firstNames = ['James','Maria','Chen','Amir','Sofia','Luca','Yuki','Ravi','Emma','Noah',
  'Fatima','Oliver','Aisha','Liam','Priya','Finn','Leila','Mason','Zara','Ethan',
  'Nadia','Lucas','Hana','Diego','Rosa','Kai','Ava','Raj','Mia','Tom'];
const lastNames = ['Müller','Tanaka','Schmidt','Santos','Kim','Weber','Rossi','Nguyen',
  'Schneider','Schmidt','Dubois','Ali','Silva','Müller','Park','Singh','Santoro',
  'Jensen','Larsen','Cohen'];
const domains = ['contoso.com','northwind.com'];

const departments = [
  { id: 'D001', name: 'Finance', color: '#1e40af', location: 'Frankfurt', costCenter: 'CC-FIN' },
  { id: 'D002', name: 'Engineering', color: '#065f46', location: 'Berlin', costCenter: 'CC-ENG' },
  { id: 'D003', name: 'Sales', color: '#7c2d12', location: 'Munich', costCenter: 'CC-SLS' },
  { id: 'D004', name: 'HR', color: '#581c87', location: 'Hamburg', costCenter: 'CC-HR' },
  { id: 'D005', name: 'Operations', color: '#1e3a5f', location: 'Stuttgart', costCenter: 'CC-OPS' },
  { id: 'D006', name: 'Legal', color: '#4a1d1d', location: 'Düsseldorf', costCenter: 'CC-LEG' },
  { id: 'D007', name: 'Marketing', color: '#134e4a', location: 'Cologne', costCenter: 'CC-MKT' },
  { id: 'D008', name: 'IT', color: '#1e293b', location: 'Zurich', costCenter: 'CC-IT' },
];

const projectNames = [
  'SAP S/4HANA Migration','Cloud Infrastructure Upgrade','Data Governance Initiative',
  'Customer Portal Redesign','GDPR Compliance Automation','ML-based Demand Forecasting',
  'Vendor Management System','Employee Onboarding Portal','Financial Reporting Redesign',
  'Supply Chain Analytics','IoT Sensor Network','Mobile Workforce App',
  'API Integration Hub','Security Audit 2026','Sustainability Reporting',
  'CRM Consolidation','E-Procurement Rollout','BI Self-Service Rollout',
  'Digital Twin Pilot','Edge Computing PoC',
];

const docTypes = [
  { type: 'spec',    ext: 'pdf', weight: 0.25 },
  { type: 'report',  ext: 'xlsx', weight: 0.20 },
  { type: 'policy',  ext: 'docx', weight: 0.15 },
  { type: 'manual',  ext: 'pdf', weight: 0.12 },
  { type: 'presentation', ext: 'pptx', weight: 0.13 },
  { type: 'contract', ext: 'pdf', weight: 0.10 },
  { type: 'data',    ext: 'csv', weight: 0.05 },
];

const tagsPool = [
  'SAP','S/4HANA','Cloud','Security','GDPR','Finance','Engineering',
  'Compliance','ML','Analytics','Integration','API','Migration','Governance',
  'Automation','Reporting','BI','UX','Mobile','IoT','Edge','Sustainability',
  'CRM','Procurement','HR','Onboarding','Data','Quality','Testing',
  'Staging','Production','Pilot','RFC','Approved','Draft','Review',
];

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
let seed = 42;
function rnd(min, max) { seed = (seed * 16807) % 2147483647; return min + (seed % (max - min + 1)); }
function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
function pickN(arr, n) { const s = [...arr]; for (let i = s.length - 1; i > 0; i--) { const j = rnd(0, i); [s[i],s[j]] = [s[j],s[i]]; } return s.slice(0, n); }

// ─── Generate Users (150) ─────────────────────────────────────────────────────
const users = [];
for (let i = 0; i < 150; i++) {
  const fn = pick(firstNames);
  const ln = pick(lastNames);
  const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i > 99 ? i : ''}@${pick(domains)}`;
  const dept = pick(departments);
  const manager = i < 20 ? null : users[rnd(0, i - 1)]?.id || null;
  const title = i < 5 ? 'VP' : i < 15 ? 'Director' : i < 40 ? 'Senior Manager' : i < 80 ? 'Manager' : i < 120 ? 'Specialist' : 'Analyst';
  const hireYear = rnd(2016, 2025);
  const hireMonth = rnd(1, 12);
  users.push({
    id: `U${String(i + 1).padStart(4, '0')}`,
    email, firstName: fn, lastName: ln,
    title, departmentId: dept.id,
    managerId: manager,
    hireDate: `${hireYear}-${String(hireMonth).padStart(2,'0')}-${String(rnd(1,28)).padStart(2,'0')}`,
    location: dept.location,
    active: rnd(0, 9) > 0,
    skills: pickN(tagsPool, rnd(2, 6)),
  });
}

// ─── Generate Projects (20) ───────────────────────────────────────────────────
const projects = [];
const startDates = ['2025-01-15','2025-03-01','2025-04-15','2025-06-01','2025-07-15','2025-09-01'];
for (let i = 0; i < 20; i++) {
  const pDept = pick(departments);
  const sponsor = users.filter(u => u.departmentId === pDept.id && u.title.startsWith('VP') || u.title.startsWith('Director')).pop() || pick(users);
  const pm = pick(users.filter(u => u.title === 'Manager' || u.title === 'Senior Manager'));
  const budget = rnd(50, 500) * 1000;
  const statuses = ['Active','At Risk','On Hold','Completed'];
  const status = i < 16 ? statuses[0] : i < 18 ? statuses[1] : i === 19 ? statuses[3] : statuses[2];
  projects.push({
    id: `PRJ${String(i + 1).padStart(3, '0')}`,
    name: projectNames[i],
    departmentId: pDept.id,
    sponsorId: sponsor.id,
    projectManagerId: pm.id,
    status,
    budget: budget,
    spent: Math.round(budget * rnd(20, 80) / 100),
    startDate: pick(startDates),
    endDate: `${2025 + rnd(0,1)}-${String(rnd(1,12)).padStart(2,'0')}-${String(rnd(1,28)).padStart(2,'0')}`,
    priority: pick(['Critical','High','Medium','Low']),
    tags: pickN(tagsPool, rnd(3, 7)),
    teamMembers: pickN(users.filter(u => u.departmentId === pDept.id || Math.random() > 0.5), rnd(4, 10)).map(u => u.id),
  });
}

// ─── Generate Documents (600) ─────────────────────────────────────────────────
const documents = [];
const siteNames = ['Executive','Finance','Engineering','Sales','HR','Operations','Legal','Marketing','IT','Facilities'];
for (let i = 0; i < 600; i++) {
  const dt = docTypes[rnd(0, docTypes.length - 1)];
  const site = pick(siteNames);
  const dept = pick(departments);
  const author = pick(users);
  const createdYear = rnd(2023, 2025);
  const createdMonth = rnd(1, 12);
  const modifiedOffset = rnd(0, 180);
  const fileName = `${pick(['Report','Analysis','Spec','Guide','Policy','Template','Brief','Overview','Plan','Dashboard','Invoice','Contract'])}${rnd(10,999)}_v${rnd(1,5)}.${dt.ext}`;
  documents.push({
    id: `DOC${String(i + 1).padStart(5, '0')}`,
    fileName,
    title: fileName.replace(/\.(pdf|xlsx|docx|pptx|csv)$/, '').replace(/_/g, ' '),
    site,
    departmentId: dept.id,
    authorId: author.id,
    docType: dt.type,
    sizeKB: rnd(50, 8000),
    createdAt: `${createdYear}-${String(createdMonth).padStart(2,'0')}-${String(rnd(1,28)).padStart(2,'0')}`,
    modifiedAt: `${createdYear}-${String(Math.min(12, createdMonth + rnd(0,3))).padStart(2,'0')}-${String(rnd(1,28)).padStart(2,'0')}`,
    version: rnd(1, 8),
    status: pick(['Published','Draft','Review','Archived']),
    versionCount: rnd(1, 8),
    downloadCount: rnd(0, 500),
    tags: pickN(tagsPool, rnd(2, 5)),
    projectId: Math.random() > 0.4 ? pick(projects).id : null,
  });
}

// ─── Generate Tasks (300) ─────────────────────────────────────────────────────
const tasks = [];
const priorities = ['Critical','High','Medium','Low'];
const taskTitles = [
  'Review and approve design specs','Update KPI dashboards','Conduct security audit',
  'Prepare quarterly report','Migrate data to cloud storage','Code review for release',
  'Update training materials','Deploy to staging environment','Write unit tests',
  'Update API documentation','Analyze user feedback','Prepare stakeholder presentation',
  'Configure monitoring alerts','Review vendor contracts','Update GDPR compliance docs',
  'Optimize SQL queries','Test ML model performance','Roll out new onboarding flow',
  'Prepare budget forecast','Review integration test results','Update SOX controls documentation',
];
for (let i = 0; i < 300; i++) {
  const assignee = pick(users);
  const project = pick(projects);
  const status = pick(['Open','In Progress','Blocked','Done','Cancelled']);
  const priority = pick(priorities);
  const createdDaysAgo = rnd(1, 120);
  tasks.push({
    id: `TSK${String(i + 1).padStart(4, '0')}`,
    title: pick(taskTitles),
    projectId: project.id,
    assigneeId: assignee.id,
    reporterId: pick(users.filter(u => u.id !== assignee.id)).id,
    status,
    priority,
    dueDate: `2026-${String(rnd(1,6)).padStart(2,'0')}-${String(rnd(1,28)).padStart(2,'0')}`,
    createdAt: new Date(Date.now() - createdDaysAgo * 86400000).toISOString().split('T')[0],
    storyPoints: pick([1,2,3,5,8,13]),
    tags: pickN(tagsPool, rnd(1, 4)),
  });
}

// ─── Generate Relationships (triples for KG) ─────────────────────────────────
const triples = [];

// User -> works in -> Department
users.forEach(u => {
  triples.push({ subject: u.id, predicate: 'WORKS_IN', object: u.departmentId });
  if (u.managerId) triples.push({ subject: u.id, predicate: 'REPORTS_TO', object: u.managerId });
});

// User -> is member of -> Project
projects.forEach(p => {
  p.teamMembers.forEach(uid => {
    triples.push({ subject: uid, predicate: 'MEMBER_OF', object: p.id });
  });
  triples.push({ subject: p.sponsorId, predicate: 'SPONSORS', object: p.id });
  triples.push({ subject: p.projectManagerId, predicate: 'MANAGES', object: p.id });
});

// Document -> authored by -> User
documents.slice(0, 400).forEach(d => {
  triples.push({ subject: d.id, predicate: 'AUTHORED_BY', object: d.authorId });
  triples.push({ subject: d.id, predicate: 'BELONGS_TO', object: d.departmentId });
  if (d.projectId) triples.push({ subject: d.id, predicate: 'RELATED_TO', object: d.projectId });
});

// Task -> assigned to -> User
tasks.forEach(t => {
  triples.push({ subject: t.id, predicate: 'ASSIGNED_TO', object: t.assigneeId });
  triples.push({ subject: t.id, predicate: 'PART_OF', object: t.projectId });
  if (t.reporterId) triples.push({ subject: t.id, predicate: 'REPORTED_BY', object: t.reporterId });
});

// Document -> related to -> Document (cross-references)
for (let i = 0; i < 100; i++) {
  const d1 = pick(documents);
  const d2 = pick(documents);
  if (d1.id !== d2.id) {
    triples.push({ subject: d1.id, predicate: 'REFERENCES', object: d2.id });
  }
}

// User -> follows -> Document
users.slice(0, 50).forEach(u => {
  pickN(documents, rnd(2, 8)).forEach(d => {
    triples.push({ subject: u.id, predicate: 'FOLLOWS', object: d.id });
  });
});

// Project -> depends on -> Project
[[0,3],[1,5],[2,6],[4,7],[8,9],[10,11],[12,14],[15,16],[17,18]].forEach(([a,b]) => {
  if (projects[a] && projects[b]) {
    triples.push({ subject: projects[a].id, predicate: 'DEPENDS_ON', object: projects[b].id });
  }
});

// ─── Save All ─────────────────────────────────────────────────────────────────
const data = {
  metadata: {
    generated: new Date().toISOString(),
    counts: { users: users.length, departments: departments.length, projects: projects.length, documents: documents.length, tasks: tasks.length, triples: triples.length }
  },
  departments,
  users,
  projects,
  documents,
  tasks,
  triples,
};

fs.writeFileSync(path.join(OUT, 'sharepoint_data.json'), JSON.stringify(data, null, 2));
fs.writeFileSync(path.join(OUT, 'triples.csv'), [
  'subject,predicate,object,subject_type,predicate_type,object_type',
  ...triples.map(t => {
    const st = t.subject.startsWith('U') ? 'Person' : t.subject.startsWith('D') ? 'Department' : t.subject.startsWith('PRJ') ? 'Project' : t.subject.startsWith('DOC') ? 'Document' : 'Task';
    const pt = ['WORKS_IN','REPORTS_TO','MEMBER_OF','SPONSORS','MANAGES','AUTHORED_BY','BELONGS_TO','RELATED_TO','ASSIGNED_TO','PART_OF','REFERENCES','FOLLOWS','DEPENDS_ON'][rnd(0,12)] || 'RELATES_TO';
    const ot = t.object.startsWith('U') ? 'Person' : t.object.startsWith('D') ? 'Department' : t.object.startsWith('PRJ') ? 'Project' : t.object.startsWith('DOC') ? 'Document' : 'Task';
    return `${t.subject},${t.predicate},${t.object},${st},${pt},${ot}`;
  })
].join('\n'));

fs.writeFileSync(path.join(OUT, 'entities_users.json'), JSON.stringify(users, null, 2));
fs.writeFileSync(path.join(OUT, 'entities_departments.json'), JSON.stringify(departments, null, 2));
fs.writeFileSync(path.join(OUT, 'entities_projects.json'), JSON.stringify(projects, null, 2));
fs.writeFileSync(path.join(OUT, 'entities_documents.json'), JSON.stringify(documents, null, 2));
fs.writeFileSync(path.join(OUT, 'entities_tasks.json'), JSON.stringify(tasks, null, 2));

console.log('=== Synthetic SharePoint Data Generated ===');
console.log(`  Users:        ${users.length}`);
console.log(`  Departments:  ${departments.length}`);
console.log(`  Projects:     ${projects.length}`);
console.log(`  Documents:    ${documents.length}`);
console.log(`  Tasks:        ${tasks.length}`);
console.log(`  KG Triples:   ${triples.length}`);
console.log('');
console.log('Files saved to:', OUT);
console.log('  sharepoint_data.json  (all-in-one)');
console.log('  triples.csv           (for HANA KG import)');
console.log('  entities_*.json        (per-entity JSON files)');

// Print sample triples
console.log('\n=== Sample KG Triples ===');
triples.slice(0, 8).forEach(t => console.log(`  ${t.subject} --[${t.predicate}]--> ${t.object}`));