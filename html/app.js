// SimpleLiteDB Explorer v4.0 - Core Logic
let dashToken = localStorage.getItem('slite_token');
let allDatabases = [];
let currentActive = { db: '', table: '', apiKey: '' };
let lastView = 'view-welcome';

const el = (id) => document.getElementById(id);

// --- 1. Initialization ---
if (dashToken) {
    el('userDisplay').innerText = localStorage.getItem('slite_user') || 'Admin';
    loadAllDatabases();
}

// --- 2. Logout ---
function logout() {
    localStorage.removeItem('slite_token');
    localStorage.removeItem('slite_user');
    window.location.href = '/dashboard/login';
}

// --- 3. Databases & Sidebar ---
async function loadAllDatabases() {
    try {
        const res = await fetch('/admin/databases', {
            headers: { 'Authorization': `Bearer ${dashToken}` }
        });
        if (res.status === 401) return logout();
        const data = await res.json();
        if (!data.success) throw new Error(data.detail);
        allDatabases = data.databases;
        renderSidebar();
    } catch (err) { console.error("Load databases failed:", err); }
}

async function renderSidebar() {
    const list = el('sidebarContent');
    list.innerHTML = '';
    for (const db of allDatabases) {
        const dbDiv = document.createElement('div');
        dbDiv.className = "mb-1";
        
        let tables = [];
        try {
            const res = await fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${db.api_key}` },
                body: JSON.stringify({ database: db.name, sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'" })
            });
            const d = await res.json();
            tables = d.rows || [];
        } catch (e) {}

        const isActiveDb = currentActive.db === db.name;
        dbDiv.innerHTML = `
            <div class="db-node ${isActiveDb ? 'active' : ''} group" onclick="showSqlTab('${db.name}', '${db.api_key}')">
                <div class="flex items-center gap-2 flex-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isActiveDb ? 'text-[#3ecf8e]' : 'text-slate-400 group-hover:text-slate-600'}"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                    <span class="truncate">${db.name}</span>
                </div>
                <button onclick="event.stopPropagation(); showCreateTable('${db.name}', '${db.api_key}')" class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-100 border border-slate-200 rounded transition-all" title="New Table">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
            </div>
            <div class="mt-0.5">
                ${tables.map(t => {
                    const isActiveTable = currentActive.db === db.name && currentActive.table === t.name;
                    return `
                    <div class="table-node ${isActiveTable ? 'active' : ''}" onclick="showTable('${db.name}', '${t.name}', '${db.api_key}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-40"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                        <span class="truncate">${t.name}</span>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
        list.appendChild(dbDiv);
    }
}

// --- 4. Views & Actions ---
function switchView(viewId) {
    if (viewId !== 'view-api') lastView = viewId;
    ['view-welcome', 'view-table', 'view-sql', 'view-api'].forEach(id => el(id).classList.add('hidden'));
    el(viewId).classList.remove('hidden');
    
    // Toggle Top Action Bar
    if (viewId === 'view-table' || viewId === 'view-sql') {
        el('viewActions').classList.remove('hidden');
    } else {
        el('viewActions').classList.add('hidden');
    }

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    if (viewId === 'view-welcome') document.querySelectorAll('.nav-link')[0].classList.add('active');
    if (viewId === 'view-sql') document.querySelectorAll('.nav-link')[1].classList.add('active');
}

async function showTable(db, table, apiKey) {
    currentActive = { db, table, apiKey };
    el('breadcrumb').innerHTML = `<span class="text-slate-300 font-normal">/</span> ${db} <span class="text-slate-300 font-normal">/</span> <span class="text-slate-900">${table}</span>`;
    el('tableTitle').innerText = table;
    switchView('view-table');
    refreshTableData();
    renderSidebar(); 
}

function showSqlTab(dbName = '', apiKey = '') {
    if (dbName) currentActive = { db: dbName, table: '', apiKey };
    el('sqlTargetDb').innerText = `${currentActive.db || 'Select Database'}`;
    el('sqlResult').innerHTML = '';
    el('breadcrumb').innerHTML = `<span class="text-slate-300 font-normal">/</span> sql console`;
    switchView('view-sql');
    renderSidebar();
}

async function refreshTableData() {
    const { db, table, apiKey } = currentActive;
    if (!db || !table) return;
    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql: `SELECT * FROM ${table} LIMIT 100` })
        });
        const data = await res.json();
        renderGrid(data.rows, el('thead'), el('tbody'));
    } catch (err) { alert("Table refresh failed: " + err.message); }
}

function renderGrid(rows, thead, tbody) {
    if (!rows || rows.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td class="p-12 text-center text-slate-400 font-medium italic">Table is currently empty.</td></tr>';
        return;
    }
    const cols = Object.keys(rows[0]);
    thead.innerHTML = `<tr>${cols.map(c => `<th class="border-r border-slate-50 last:border-0">${c}</th>`).join('')}</tr>`;
    tbody.innerHTML = rows.map((r, idx) => `
        <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'} hover:bg-slate-50 transition-colors">
            ${cols.map(c => `<td class="border-r border-slate-50 last:border-0 truncate max-w-[300px] font-mono text-[12px]">${r[c]}</td>`).join('')}
        </tr>
    `).join('');
}

async function runSql() {
    const sql = el('sqlInput').value;
    const { db, apiKey } = currentActive;
    if (!db) return alert("Please select a database from the sidebar.");
    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        el('sqlResult').classList.remove('hidden');
        el('sqlResult').innerHTML = '<div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead id="sthead"></thead><tbody id="stbody" class="divide-y divide-slate-50"></tbody></table></div>';
        renderGrid(data.rows, el('sthead'), el('stbody'));
        if (sql.toUpperCase().match(/CREATE|DROP|ALTER/)) loadAllDatabases();
    } catch (err) { alert("SQL Error: " + err.message); }
}

// --- 5. API Documentation Page ---
function showApiView() {
    const { db, table, apiKey } = currentActive;
    if (!db) return alert("Please select a database first.");
    const baseUrl = window.location.origin;
    
    switchView('view-api');
    el('breadcrumb').innerHTML = `<span class="text-slate-300 font-normal">/</span> api reference`;

    el('apiContent').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white border border-slate-100 p-6 rounded-xl shadow-sm">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Endpoint URL</span>
                <code class="text-indigo-600 font-mono text-xs break-all">${baseUrl}/query</code>
            </div>
            <div class="bg-white border border-slate-100 p-6 rounded-xl shadow-sm">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Target Database</span>
                <code class="text-[#3ecf8e] font-mono text-xs">${db}</code>
            </div>
            <div class="bg-white border border-slate-100 p-6 rounded-xl shadow-sm">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Authorization</span>
                <code class="text-slate-900 font-mono text-xs break-all">Bearer ${apiKey}</code>
            </div>
        </div>

        <div class="space-y-12 pt-8 border-t border-slate-50">
            <div>
                <h3 class="text-lg font-bold text-slate-900 mb-4">Vanilla JavaScript</h3>
                <div class="code-block">
                    <span class="code-badge">JS / FETCH</span>
                    <pre class="text-[#334155] text-[13px] font-mono leading-relaxed"><span class="text-[#0284c7]">fetch</span>('${baseUrl}/query', {
  method: <span class="text-[#475569]">'POST'</span>,
  headers: {
    <span class="text-[#0284c7]">'Content-Type'</span>: <span class="text-[#475569]">'application/json'</span>,
    <span class="text-[#0284c7]">'Authorization'</span>: <span class="text-[#475569]">'Bearer ${apiKey}'</span>
  },
  body: <span class="text-[#0284c7]">JSON</span>.stringify({
    database: <span class="text-[#475569]">'${db}'</span>,
    sql: <span class="text-[#475569]">'SELECT * FROM ${table || 'your_table'}'</span>
  })
}).then(res => res.json()).then(console.log);</pre>
                </div>
            </div>

            <div>
                <h3 class="text-lg font-bold text-slate-900 mb-4">Next.js Implementation</h3>
                <div class="code-block">
                    <span class="code-badge">React / Server Side</span>
                    <pre class="text-[#334155] text-[13px] font-mono leading-relaxed"><span class="text-[#2563eb]">const</span> res = <span class="text-[#2563eb]">await</span> <span class="text-[#0284c7]">fetch</span>('${baseUrl}/query', {
  method: <span class="text-[#475569]">'POST'</span>,
  headers: {
    <span class="text-[#0284c7]">'Authorization'</span>: <span class="text-[#475569]">\`Bearer $\{process.env.SLITE_API_KEY\}\`</span>,
    <span class="text-[#0284c7]">'Content-Type'</span>: <span class="text-[#475569]">'application/json'</span>
  },
  body: <span class="text-[#0284c7]">JSON</span>.stringify({
    database: <span class="text-[#475569]">'${db}'</span>,
    sql: <span class="text-[#475569]">'SELECT * FROM ${table || 'your_table'}'</span>
  }),
  cache: <span class="text-[#475569]">'no-store'</span>
});
<span class="text-[#2563eb]">const</span> data = <span class="text-[#2563eb]">await</span> res.json();</pre>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 class="text-lg font-bold text-slate-900 mb-4">Python (Requests)</h3>
                    <div class="code-block">
                        <span class="code-badge">Python 3</span>
                        <pre class="text-[#334155] text-[12px] font-mono leading-relaxed"><span class="text-[#2563eb]">import</span> requests

res = requests.post('${baseUrl}/query', 
  headers={<span class="text-[#0284c7]">'Authorization'</span>: <span class="text-[#475569]">'Bearer ${apiKey}'</span>},
  json={
    <span class="text-[#0284c7]">'database'</span>: <span class="text-[#475569]">'${db}'</span>,
    <span class="text-[#0284c7]">'sql'</span>: <span class="text-[#475569]">'SELECT * FROM ${table || 'table'}'</span>
  }
)
<span class="text-[#0284c7]">print</span>(res.json())</pre>
                    </div>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-slate-900 mb-4">PHP</h3>
                    <div class="code-block">
                        <span class="code-badge">cURL</span>
                        <pre class="text-[#334155] text-[12px] font-mono leading-relaxed"><span class="text-[#475569]">$ch</span> = curl_init('${baseUrl}/query');
curl_setopt(<span class="text-[#475569]">$ch</span>, CURLOPT_POSTFIELDS, json_encode([
  <span class="text-[#0284c7]">'database'</span> => <span class="text-[#475569]">'${db}'</span>,
  <span class="text-[#0284c7]">'sql'</span> => <span class="text-[#475569]">'SELECT * FROM ${table || 'table'}'</span>
]));
curl_setopt(<span class="text-[#475569]">$ch</span>, CURLOPT_HTTPHEADER, [
  <span class="text-[#475569]">'Authorization: Bearer ${apiKey}'</span>,
  <span class="text-[#475569]">'Content-Type: application/json'</span>
]);
curl_setopt(<span class="text-[#475569]">$ch</span>, CURLOPT_RETURNTRANSFER, <span class="text-[#2563eb]">true</span>);
<span class="text-[#475569]">$response</span> = curl_exec(<span class="text-[#475569]">$ch</span>);</pre>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function switchBackFromApi() {
    switchView(lastView);
}

// --- 6. Creation Modals ---
function showCreateDb() {
    el('newDbName').value = '';
    el('createDbModal').classList.remove('hidden');
    el('newDbName').focus();
}

async function submitCreateDb() {
    const name = el('newDbName').value.trim();
    if (!name) return alert("Database name is required.");
    try {
        const res = await fetch('/admin/create_db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dashToken}` },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.success) {
            el('createDbModal').classList.add('hidden');
            loadAllDatabases();
        } else alert("Creation error: " + data.error);
    } catch (err) { alert(err.message); }
}

function showCreateTable(db, apiKey) {
    currentActive = { db, table: '', apiKey };
    el('currentDbName').innerText = db;
    el('newTableName').value = '';
    el('newTableSql').value = 'id INTEGER PRIMARY KEY AUTOINCREMENT,\nname TEXT,\ncreated_at DATETIME DEFAULT CURRENT_TIMESTAMP';
    el('createTableModal').classList.remove('hidden');
}

async function submitCreateTable() {
    const table = el('newTableName').value.trim();
    const cols = el('newTableSql').value.trim();
    const { db, apiKey } = currentActive;
    if (!table || !cols) return alert("Table name and structure are required.");

    const sql = `CREATE TABLE ${table} (${cols})`;
    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql })
        });
        const data = await res.json();
        if (data.success) {
            el('createTableModal').classList.add('hidden');
            loadAllDatabases();
            showTable(db, table, apiKey);
        } else alert("Create Table Error: " + data.error);
    } catch (err) { alert(err.message); }
}
