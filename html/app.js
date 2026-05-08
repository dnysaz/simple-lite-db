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
                <div class="flex items-center justify-between">
                    <code class="text-indigo-600 font-mono text-xs break-all">${baseUrl}/query</code>
                    <button onclick="copyCode(this, '${baseUrl}/query')" class="text-slate-400 hover:text-[#3ecf8e] transition-colors ml-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                </div>
            </div>
            <div class="bg-white border border-slate-100 p-6 rounded-xl shadow-sm">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Target Database</span>
                <code class="text-[#3ecf8e] font-mono text-xs">${db}</code>
            </div>
            <div class="bg-white border border-slate-100 p-6 rounded-xl shadow-sm">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Authorization Header</span>
                <div class="flex items-center justify-between">
                    <code class="text-slate-900 font-mono text-xs break-all">Bearer ${apiKey}</code>
                    <button onclick="copyCode(this, 'Bearer ${apiKey}')" class="text-slate-400 hover:text-[#3ecf8e] transition-colors ml-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                </div>
            </div>
        </div>

        <div class="pt-8 space-y-16">
            <!-- Environment Setup -->
            <div class="bg-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                <div class="absolute top-0 right-0 p-8 opacity-10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h3 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3m-3-3l-2.25-2.25"/></svg>
                    Security Best Practice: Environment Variables
                </h3>
                <p class="text-slate-400 text-sm mb-6 max-w-2xl">Jangan pernah melakukan hardcode API Key di dalam kode Anda. Simpan kredensial di file <code class="text-[#3ecf8e]">.env</code> untuk mencegah kebocoran data.</p>
                <div class="code-block bg-white/5 border-white/10 p-6 group">
                    <button onclick="copyBlock(this)" class="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-md text-white opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5 text-[10px] font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        COPY .ENV
                    </button>
                    <pre class="text-emerald-400 font-mono text-sm leading-relaxed">SLITE_URL=${baseUrl}&#10;SLITE_API_KEY=${apiKey}&#10;SLITE_DB=${db}</pre>
                </div>
            </div>

            <!-- Vanilla JS -->
            <div>
                <h3 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span class="w-1.5 h-6 bg-yellow-400 rounded-full"></span>
                    Vanilla JavaScript (Async/Await)
                </h3>
                <div class="code-block group">
                    <span class="code-badge">JavaScript</span>
                    <button onclick="copyBlock(this)" class="absolute top-10 right-4 p-2 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-[#3ecf8e] opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5 text-[10px] font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        COPY CODE
                    </button>
                    <pre class="text-[#334155] text-[13px] font-mono leading-relaxed overflow-x-auto"><span class="text-[#2563eb]">async function</span> <span class="text-[#0284c7]">queryDatabase</span>() {
  <span class="text-[#2563eb]">const</span> response = <span class="text-[#2563eb]">await</span> <span class="text-[#0284c7]">fetch</span>(<span class="text-[#475569]">'${baseUrl}/query'</span>, {
    method: <span class="text-[#475569]">'POST'</span>,
    headers: {
      <span class="text-[#0284c7]">'Content-Type'</span>: <span class="text-[#475569]">'application/json'</span>,
      <span class="text-[#0284c7]">'Authorization'</span>: <span class="text-[#475569]">'Bearer ${apiKey}'</span>
    },
    body: <span class="text-[#0284c7]">JSON</span>.stringify({
      database: <span class="text-[#475569]">'${db}'</span>,
      sql: <span class="text-[#475569]">'SELECT * FROM ${table || 'your_table'}'</span>
    })
  });
  
  <span class="text-[#2563eb]">if</span> (!response.ok) <span class="text-[#2563eb]">throw new Error</span>(<span class="text-[#475569]">'Request Failed'</span>);
  <span class="text-[#2563eb]">const</span> data = <span class="text-[#2563eb]">await</span> response.json();
  <span class="text-[#0284c7]">console</span>.log(data);
}</pre>
                </div>
            </div>

            <!-- Next.js -->
            <div>
                <h3 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span class="w-1.5 h-6 bg-slate-900 rounded-full"></span>
                    Next.js Server Side (Best Practice)
                </h3>
                <div class="code-block group">
                    <span class="code-badge">Next.js</span>
                    <button onclick="copyBlock(this)" class="absolute top-10 right-4 p-2 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-[#3ecf8e] opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5 text-[10px] font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        COPY CODE
                    </button>
                    <pre class="text-[#334155] text-[13px] font-mono leading-relaxed overflow-x-auto"><span class="text-[#2563eb]">export async function</span> <span class="text-[#0284c7]">getData</span>() {
  <span class="text-[#2563eb]">const</span> res = <span class="text-[#2563eb]">await</span> <span class="text-[#0284c7]">fetch</span>(<span class="text-[#475569]">\`$\{process.env.SLITE_URL\}/query\`</span>, {
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

  <span class="text-[#2563eb]">if</span> (!res.ok) <span class="text-[#2563eb]">return</span> { success: <span class="text-[#2563eb]">false</span> };
  <span class="text-[#2563eb]">return</span> res.json();
}</pre>
                </div>
            </div>

            <!-- Python -->
            <div>
                <h3 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span class="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                    Python 3 (Environment Based)
                </h3>
                <div class="code-block group">
                    <span class="code-badge">Python</span>
                    <button onclick="copyBlock(this)" class="absolute top-10 right-4 p-2 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-[#3ecf8e] opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5 text-[10px] font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        COPY CODE
                    </button>
                    <pre class="text-[#334155] text-[13px] font-mono leading-relaxed overflow-x-auto"><span class="text-[#2563eb]">import</span> os, requests
<span class="text-[#2563eb]">from</span> dotenv <span class="text-[#2563eb]">import</span> load_dotenv

load_dotenv() <span class="text-slate-400"># Load .env file</span>

URL = os.getenv(<span class="text-[#475569]">'SLITE_URL'</span>)
KEY = os.getenv(<span class="text-[#475569]">'SLITE_API_KEY'</span>)

response = requests.post(
    <span class="text-[#475569]">f"{URL}/query"</span>, 
    headers={<span class="text-[#0284c7]">'Authorization'</span>: <span class="text-[#475569]">f"Bearer {KEY}"</span>},
    json={
        <span class="text-[#0284c7]">'database'</span>: <span class="text-[#475569]">'${db}'</span>,
        <span class="text-[#0284c7]">'sql'</span>: <span class="text-[#475569]">'SELECT * FROM ${table || 'table'}'</span>
    }
)
response.raise_for_status() <span class="text-slate-400"># Check for errors</span>
<span class="text-[#0284c7]">print</span>(response.json())</pre>
                </div>
            </div>

            <!-- PHP -->
            <div>
                <h3 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span class="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                    PHP / cURL (Secure)
                </h3>
                <div class="code-block group">
                    <span class="code-badge">PHP</span>
                    <button onclick="copyBlock(this)" class="absolute top-10 right-4 p-2 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-[#3ecf8e] opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5 text-[10px] font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        COPY CODE
                    </button>
                    <pre class="text-[#334155] text-[13px] font-mono leading-relaxed overflow-x-auto"><span class="text-[#475569]">$url</span> = <span class="text-[#0284c7]">getenv</span>(<span class="text-[#475569]">'SLITE_URL'</span>);
<span class="text-[#475569]">$key</span> = <span class="text-[#0284c7]">getenv</span>(<span class="text-[#475569]">'SLITE_API_KEY'</span>);

<span class="text-[#475569]">$ch</span> = curl_init(<span class="text-[#475569]">$url</span> . <span class="text-[#475569]">'/query'</span>);
curl_setopt(<span class="text-[#475569]">$ch</span>, CURLOPT_RETURNTRANSFER, <span class="text-[#2563eb]">true</span>);
curl_setopt(<span class="text-[#475569]">$ch</span>, CURLOPT_POST, <span class="text-[#2563eb]">true</span>);
curl_setopt(<span class="text-[#475569]">$ch</span>, CURLOPT_POSTFIELDS, json_encode([
  <span class="text-[#0284c7]">'database'</span> => <span class="text-[#475569]">'${db}'</span>,
  <span class="text-[#0284c7]">'sql'</span> => <span class="text-[#475569]">'SELECT * FROM ${table || 'table'}'</span>
]));
curl_setopt(<span class="text-[#475569]">$ch</span>, CURLOPT_HTTPHEADER, [
  <span class="text-[#475569]">'Authorization: Bearer '</span> . <span class="text-[#475569]">$key</span>,
  <span class="text-[#475569]">'Content-Type: application/json'</span>
]);

<span class="text-[#475569]">$response</span> = curl_exec(<span class="text-[#475569]">$ch</span>);
<span class="text-[#2563eb]">if</span> (curl_errno(<span class="text-[#475569]">$ch</span>)) <span class="text-[#2563eb]">echo</span> <span class="text-[#475569]">'Error:'</span> . curl_error(<span class="text-[#475569]">$ch</span>);
curl_close(<span class="text-[#475569]">$ch</span>);</pre>
                </div>
            </div>
        </div>
    `;
}

async function doCopy(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
    }
}

async function copyCode(btn, text) {
    await doCopy(text);
    const original = btn.innerHTML;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    btn.classList.add('text-[#3ecf8e]');
    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('text-[#3ecf8e]');
    }, 2000);
}

async function copyBlock(btn) {
    const pre = btn.parentElement.querySelector('pre');
    await doCopy(pre.innerText);
    const original = btn.innerHTML;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> COPIED';
    btn.classList.add('text-[#3ecf8e]', 'border-[#3ecf8e]/30', 'bg-emerald-50');
    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('text-[#3ecf8e]', 'border-[#3ecf8e]/30', 'bg-emerald-50');
    }, 2000);
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
