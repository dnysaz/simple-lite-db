// SimpleLiteDB Explorer v2.0 - Core Logic
let dashToken = localStorage.getItem('slite_token');
let allDatabases = [];
let currentActive = { db: '', table: '', apiKey: '' };

const el = (id) => document.getElementById(id);

// --- Initialization ---
if (dashToken) {
    el('userDisplay').innerText = localStorage.getItem('slite_user') || 'Admin';
    loadAllDatabases();
}

// --- 1. Logout ---
function logout() {
    localStorage.removeItem('slite_token');
    localStorage.removeItem('slite_user');
    window.location.href = '/dashboard/login';
}

// --- 2. Databases & Sidebar ---
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
            <div class="db-node ${isActiveDb ? 'active' : ''}" onclick="showSqlTab('${db.name}', '${db.api_key}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isActiveDb ? 'text-[#3ecf8e]' : 'text-slate-500'}"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                <span class="truncate">${db.name}</span>
            </div>
            <div class="mt-1">
                ${tables.map(t => {
                    const isActiveTable = currentActive.db === db.name && currentActive.table === t.name;
                    return `
                    <div class="table-node ${isActiveTable ? 'active' : ''}" onclick="showTable('${db.name}', '${t.name}', '${db.api_key}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-50"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                        <span class="truncate">${t.name}</span>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
        list.appendChild(dbDiv);
    }
}

// --- 3. Views & Actions ---
function switchView(viewId) {
    ['view-welcome', 'view-table', 'view-sql'].forEach(id => el(id).classList.add('hidden'));
    el(viewId).classList.remove('hidden');
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
}

async function showTable(db, table, apiKey) {
    currentActive = { db, table, apiKey };
    el('breadcrumb').innerHTML = `
        <span class="text-slate-400 font-medium">${db}</span> 
        <span class="text-slate-300">/</span> 
        <span class="text-slate-900 font-bold">${table}</span>
    `;
    el('tableTitle').innerText = table;
    switchView('view-table');
    refreshTableData();
    renderSidebar(); // Update active state
}

function showSqlTab(dbName = '', apiKey = '') {
    if (dbName) currentActive = { db: dbName, table: '', apiKey };
    el('sqlTargetDb').innerText = `${currentActive.db || 'Select Database'}`;
    el('sqlResult').innerHTML = '';
    switchView('view-sql');
    document.querySelectorAll('.nav-link')[1].classList.add('active');
    renderSidebar(); // Update active state
}

async function refreshTableData() {
    const { db, table, apiKey } = currentActive;
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
    thead.innerHTML = `<tr>${cols.map(c => `<th class="border-r border-slate-100 last:border-0">${c}</th>`).join('')}</tr>`;
    tbody.innerHTML = rows.map((r, idx) => `
        <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/50 transition-colors">
            ${cols.map(c => `<td class="border-r border-slate-100 last:border-0 truncate max-w-[250px] font-mono">${r[c]}</td>`).join('')}
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
        el('sqlResult').innerHTML = '<div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead id="sthead"></thead><tbody id="stbody" class="divide-y divide-slate-50 text-[13px] text-slate-600 font-inter"></tbody></table></div>';
        renderGrid(data.rows, el('sthead'), el('stbody'));
        if (sql.toUpperCase().match(/CREATE|DROP|ALTER/)) loadAllDatabases();
    } catch (err) { alert("SQL Error: " + err.message); }
}

// --- 4. Database Creation Modal ---
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
            alert(`✅ Database ${data.name} created!`);
            loadAllDatabases();
        } else alert("Creation error: " + data.error);
    } catch (err) { alert(err.message); }
}

// --- 5. API Reference Guide ---
function showApiInfo() {
    const { db, table, apiKey } = currentActive;
    const baseUrl = window.location.origin;
    el('apiModal').classList.remove('hidden');
    
    el('apiContent').innerHTML = `
        <!-- Credentials Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-6 bg-slate-900 rounded-lg text-white border-t-4 border-indigo-500 shadow-lg">
                <span class="text-slate-500 text-[10px] uppercase font-black tracking-widest block mb-2">API Endpoint</span>
                <div class="text-xs font-mono select-all text-indigo-300 break-all">${baseUrl}/query</div>
            </div>
            <div class="p-6 bg-slate-900 rounded-lg text-white border-t-4 border-emerald-500 shadow-lg">
                <span class="text-slate-500 text-[10px] uppercase font-black tracking-widest block mb-2">Database Name</span>
                <div class="text-xs font-mono text-emerald-400 select-all">${db}</div>
            </div>
            <div class="p-6 bg-slate-900 rounded-lg text-white border-t-4 border-amber-500 shadow-lg">
                <span class="text-slate-500 text-[10px] uppercase font-black tracking-widest block mb-2">Authorization Header</span>
                <div class="text-xs font-mono text-amber-400 select-all break-all">Bearer ${apiKey}</div>
            </div>
        </div>

        <div class="space-y-6 mt-12">
            <h4 class="text-[12px] font-black uppercase tracking-[0.4em] text-slate-400 border-b border-slate-100 pb-3">Code Implementation Examples</h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Vanilla JS -->
                <div class="space-y-2">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-yellow-400"></span>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-tight">JavaScript (Fetch)</p>
                    </div>
                    <pre class="p-4 bg-[#1E293B] rounded-lg text-[11px] leading-relaxed text-slate-300 overflow-x-auto border border-slate-800 shadow-inner font-mono"><span class="text-pink-400">fetch</span>(<span class="text-amber-300">'${baseUrl}/query'</span>, {
  <span class="text-slate-400">method</span>: <span class="text-amber-300">'POST'</span>,
  <span class="text-slate-400">headers</span>: {
    <span class="text-amber-300">'Content-Type'</span>: <span class="text-amber-300">'application/json'</span>,
    <span class="text-amber-300">'Authorization'</span>: <span class="text-amber-300">'Bearer ${apiKey}'</span>
  },
  <span class="text-slate-400">body</span>: <span class="text-cyan-400">JSON</span>.<span class="text-pink-400">stringify</span>({
    <span class="text-slate-400">database</span>: <span class="text-amber-300">'${db}'</span>,
    <span class="text-slate-400">sql</span>: <span class="text-amber-300">'SELECT * FROM ${table}'</span>
  })
}).<span class="text-pink-400">then</span>(res => res.<span class="text-pink-400">json</span>())
  .<span class="text-pink-400">then</span>(<span class="text-cyan-400">console</span>.<span class="text-pink-400">log</span>);</pre>
                </div>

                <!-- Next.js -->
                <div class="space-y-2">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-slate-900"></span>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-tight">Next.js (Server Side)</p>
                    </div>
                    <pre class="p-4 bg-[#1E293B] rounded-lg text-[11px] leading-relaxed text-slate-300 overflow-x-auto border border-slate-800 shadow-inner font-mono"><span class="text-purple-400">const</span> res = <span class="text-purple-400">await</span> <span class="text-pink-400">fetch</span>(<span class="text-amber-300">'${baseUrl}/query'</span>, {
  <span class="text-slate-400">method</span>: <span class="text-amber-300">'POST'</span>,
  <span class="text-slate-400">headers</span>: {
    <span class="text-amber-300">'Authorization'</span>: <span class="text-amber-300">\`Bearer $\{process.env.SLITE_API_KEY\}\`</span>,
    <span class="text-amber-300">'Content-Type'</span>: <span class="text-amber-300">'application/json'</span>
  },
  <span class="text-slate-400">body</span>: <span class="text-cyan-400">JSON</span>.<span class="text-pink-400">stringify</span>({
    <span class="text-slate-400">database</span>: <span class="text-amber-300">'${db}'</span>,
    <span class="text-slate-400">sql</span>: <span class="text-amber-300">'SELECT * FROM ${table}'</span>
  }),
  <span class="text-slate-400">cache</span>: <span class="text-amber-300">'no-store'</span>
});
<span class="text-purple-400">const</span> data = <span class="text-purple-400">await</span> res.<span class="text-pink-400">json</span>();</pre>
                </div>

                <!-- PHP -->
                <div class="space-y-2">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-tight">PHP (cURL)</p>
                    </div>
                    <pre class="p-4 bg-[#1E293B] rounded-lg text-[11px] leading-relaxed text-slate-300 overflow-x-auto border border-slate-800 shadow-inner font-mono"><span class="text-indigo-300">$ch</span> = <span class="text-pink-400">curl_init</span>(<span class="text-amber-300">'${baseUrl}/query'</span>);
<span class="text-pink-400">curl_setopt</span>(<span class="text-indigo-300">$ch</span>, <span class="text-cyan-400">CURLOPT_RETURNTRANSFER</span>, <span class="text-emerald-400">true</span>);
<span class="text-pink-400">curl_setopt</span>(<span class="text-indigo-300">$ch</span>, <span class="text-cyan-400">CURLOPT_POSTFIELDS</span>, <span class="text-pink-400">json_encode</span>([
    <span class="text-amber-300">'database'</span> => <span class="text-amber-300">'${db}'</span>,
    <span class="text-amber-300">'sql'</span> => <span class="text-amber-300">'SELECT * FROM ${table}'</span>
]));
<span class="text-pink-400">curl_setopt</span>(<span class="text-indigo-300">$ch</span>, <span class="text-cyan-400">CURLOPT_HTTPHEADER</span>, [
    <span class="text-amber-300">'Authorization: Bearer ${apiKey}'</span>,
    <span class="text-amber-300">'Content-Type: application/json'</span>
]);
<span class="text-indigo-300">$response</span> = <span class="text-pink-400">curl_exec</span>(<span class="text-indigo-300">$ch</span>);</pre>
                </div>

                <!-- Python -->
                <div class="space-y-2">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-tight">Python (Requests)</p>
                    </div>
                    <pre class="p-4 bg-[#1E293B] rounded-lg text-[11px] leading-relaxed text-slate-300 overflow-x-auto border border-slate-800 shadow-inner font-mono"><span class="text-purple-400">import</span> requests

res = requests.<span class="text-pink-400">post</span>(<span class="text-amber-300">'${baseUrl}/query'</span>, 
    <span class="text-slate-400">headers</span>={<span class="text-amber-300">'Authorization'</span>: <span class="text-amber-300">'Bearer ${apiKey}'</span>},
    <span class="text-slate-400">json</span>={
        <span class="text-amber-300">'database'</span>: <span class="text-amber-300">'${db}'</span>,
        <span class="text-amber-300">'sql'</span>: <span class="text-amber-300">'SELECT * FROM ${table}'</span>
    }
)
<span class="text-pink-400">print</span>(res.<span class="text-pink-400">json</span>())</pre>
                </div>
            </div>
        </div>
    `;
}
