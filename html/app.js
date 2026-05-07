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
        dbDiv.className = "mb-2";
        
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

        dbDiv.innerHTML = `
            <div class="db-node" onclick="showSqlTab('${db.name}', '${db.api_key}')">
                <span class="text-[9px] opacity-40 font-black">DB</span>
                <span class="truncate">${db.name}</span>
            </div>
            <div class="space-y-[1px]">
                ${tables.map(t => `
                    <div class="table-node text-[11px]" onclick="showTable('${db.name}', '${t.name}', '${db.api_key}')">
                        <span class="truncate">${t.name}</span>
                    </div>
                `).join('')}
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
    el('breadcrumb').innerHTML = `<span class="bg-slate-100 text-[10px] px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase">${db}</span> <span class="text-slate-200">/</span> <span class="text-slate-800 font-bold">${table}</span>`;
    el('tableTitle').innerText = table;
    switchView('view-table');
    refreshTableData();
}

function showSqlTab(dbName = '', apiKey = '') {
    if (dbName) currentActive = { db: dbName, table: '', apiKey };
    el('sqlTargetDb').innerText = `${currentActive.db || 'Select Database'}`;
    el('sqlResult').innerHTML = '';
    switchView('view-sql');
    document.querySelectorAll('.nav-link')[1].classList.add('active');
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
        el('sqlResult').innerHTML = '<div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead id="sthead" class="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100"></thead><tbody id="stbody" class="divide-y divide-slate-50 text-[11px] text-slate-600 font-inter"></tbody></table></div>';
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
        <!-- Credentials Card -->
        <div class="grid grid-cols-1 gap-3">
            <div class="p-6 bg-slate-900 rounded-lg text-white border-l-4 border-indigo-500 shadow-lg">
                <div class="flex flex-col gap-3">
                    <div class="flex justify-between border-b border-slate-800 pb-2">
                        <span class="text-slate-500 text-[10px] uppercase font-black tracking-widest">API Endpoint</span>
                        <span class="text-xs font-mono select-all text-indigo-300">${baseUrl}/query</span>
                    </div>
                    <div class="flex justify-between border-b border-slate-800 pb-2">
                        <span class="text-slate-500 text-[10px] uppercase font-black tracking-widest">Database</span>
                        <span class="text-xs font-mono text-emerald-400 select-all">${db}</span>
                    </div>
                    <div class="flex justify-between border-b border-slate-800 pb-2">
                        <span class="text-slate-500 text-[10px] uppercase font-black tracking-widest">API Key (Raw)</span>
                        <span class="text-xs font-mono text-amber-400 select-all">${apiKey}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-500 text-[10px] uppercase font-black tracking-widest">Auth Header</span>
                        <span class="text-xs font-mono text-indigo-300 select-all">Bearer ${apiKey}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="space-y-6 mt-8">
            <h4 class="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Implementation Examples</h4>
            
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
