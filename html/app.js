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

let sidebarRenderId = 0;
async function renderSidebar() {
    const myRenderId = ++sidebarRenderId;
    
    // Fetch all tables in parallel for better performance
    const dbData = await Promise.all(allDatabases.map(async db => {
        try {
            const res = await fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${db.api_key}` },
                body: JSON.stringify({ database: db.name, sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'" })
            });
            const d = await res.json();
            return { ...db, tables: d.rows || [] };
        } catch (e) {
            return { ...db, tables: [] };
        }
    }));

    // If another render started while we were fetching, ignore this one
    if (myRenderId !== sidebarRenderId) return;

    const list = el('sidebarContent');
    let finalHtml = '';

    for (const db of dbData) {
        const isActiveDb = currentActive.db === db.name;
        finalHtml += `
            <div class="mb-1">
                <div class="db-node ${isActiveDb ? 'active' : ''} group" onclick="showSqlTab('${db.name}', '${db.api_key}')">
                    <div class="flex items-center gap-2 flex-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isActiveDb ? 'text-[#3ecf8e]' : 'text-slate-400 group-hover:text-slate-600'}"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                        <span class="truncate">${db.name}</span>
                    </div>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onclick="event.stopPropagation(); showCreateTable('${db.name}', '${db.api_key}')" class="p-0.5 hover:bg-emerald-50 text-emerald-600 border border-transparent hover:border-emerald-200 rounded transition-all" title="New Table">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <button onclick="event.stopPropagation(); confirmDeleteDb('${db.name}')" class="p-0.5 hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200 rounded transition-all" title="Delete Database">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                    </div>
                </div>
                <div class="mt-0.5">
                    ${db.tables.map(t => {
                        const isActiveTable = currentActive.db === db.name && currentActive.table === t.name;
                        return `
                        <div class="table-node ${isActiveTable ? 'active' : ''}" onclick="showTable('${db.name}', '${t.name}', '${db.api_key}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-40"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                            <span class="truncate">${t.name}</span>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    list.innerHTML = finalHtml;
}

// --- 4. Views & Actions ---
function switchView(viewId) {
    if (viewId !== 'view-api' && viewId !== 'view-relation') lastView = viewId;
    ['view-welcome', 'view-table', 'view-sql', 'view-api', 'view-relation'].forEach(id => el(id).classList.add('hidden'));
    el(viewId).classList.remove('hidden');
    
    // Toggle Top Action Bar
    if (viewId === 'view-table' || viewId === 'view-sql' || viewId === 'view-relation') {
        el('viewActions').classList.remove('hidden');
    } else {
        el('viewActions').classList.add('hidden');
    }

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    if (viewId === 'view-welcome') document.querySelectorAll('.nav-link')[0].classList.add('active');
    if (viewId === 'view-sql') document.querySelectorAll('.nav-link')[1].classList.add('active');
    if (viewId === 'view-relation') document.querySelectorAll('.nav-link')[2].classList.add('active');
    if (viewId === 'view-api') document.querySelectorAll('.nav-link')[3].classList.add('active');
}

async function showRelationView() {
    const { db, apiKey } = currentActive;
    if (!db) return showNotify("Required", "Please select a database first.", "error");
    
    el('relDbName').innerText = db;
    switchView('view-relation');
    el('breadcrumb').innerHTML = `<span class="text-slate-300 font-normal">/</span> ${db} <span class="text-slate-300 font-normal">/</span> <span class="text-slate-900">schema map</span>`;
    
    el('mermaid-container').innerHTML = '<div class="flex items-center justify-center p-20"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3ecf8e]"></div></div>';

    try {
        // 1. Get all tables
        const resTables = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'" })
        });
        const tablesData = await resTables.json();
        const tables = (tablesData.rows || []).map(r => r.name);

        let erString = "erDiagram\n";
        let relationships = "";

        // 2. Process each table
        for (const table of tables) {
            // Get Columns
            const resInfo = await fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ database: db, sql: `PRAGMA table_info("${table}")` })
            });
            const infoData = await resInfo.json();
            const cols = infoData.rows || [];

            erString += `    "${table}" {\n`;
            for (const c of cols) {
                const type = c.type.toLowerCase().replace(/[^a-z]/g, '');
                erString += `        ${type} ${c.name} ${c.pk ? 'PK' : ''}\n`;
            }
            erString += `    }\n`;

            // Get Foreign Keys
            const resFK = await fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ database: db, sql: `PRAGMA foreign_key_list("${table}")` })
            });
            const fkData = await resFK.json();
            const fks = fkData.rows || [];

            for (const fk of fks) {
                relationships += `    "${table}" }o--|| "${fk.table}" : "fk_${fk.from}"\n`;
            }
        }

        erString += relationships;

        // 3. Render
        const container = el('mermaid-container');
        container.innerHTML = `<pre class="mermaid">${erString}</pre>`;
        
        mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
        await mermaid.run();

    } catch (err) {
        el('mermaid-container').innerHTML = `<div class="p-8 text-red-500 font-medium">Failed to generate schema map: ${err.message}</div>`;
    }
}

function switchTableTab(tab) {
    if (tab === 'data') {
        el('tab-data').className = "px-4 py-1.5 text-xs font-bold rounded-md transition-all bg-white text-slate-900 shadow-sm";
        el('tab-settings').className = "px-4 py-1.5 text-xs font-bold rounded-md transition-all text-slate-400 hover:text-slate-600";
        el('table-data-content').classList.remove('hidden');
        el('table-settings-content').classList.add('hidden');
    } else {
        el('tab-settings').className = "px-4 py-1.5 text-xs font-bold rounded-md transition-all bg-white text-slate-900 shadow-sm";
        el('tab-data').className = "px-4 py-1.5 text-xs font-bold rounded-md transition-all text-slate-400 hover:text-slate-600";
        el('table-settings-content').classList.remove('hidden');
        el('table-data-content').classList.add('hidden');
    }
}

async function showTable(db, table, apiKey) {
    currentActive = { db, table, apiKey };
    el('breadcrumb').innerHTML = `<span class="text-slate-300 font-normal">/</span> ${db} <span class="text-slate-300 font-normal">/</span> <span class="text-slate-900">${table}</span>`;
    el('tableTitle').innerText = table;
    switchTableTab('data');
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
        // Fetch data
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql: `SELECT rowid, * FROM "${table}" LIMIT 100` })
        });
        const data = await res.json();
        
        let rows = data.rows || [];
        let cols = [];

        if (rows.length > 0) {
            cols = Object.keys(rows[0]).filter(k => k !== 'rowid');
        } else {
            // If empty, fetch column names via PRAGMA
            const schemaRes = await fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ database: db, sql: `PRAGMA table_info("${table}")` })
            });
            const schemaData = await schemaRes.json();
            cols = (schemaData.rows || []).map(r => r.name);
        }

        renderGrid(rows, cols, el('thead'), el('tbody'));
    } catch (err) { console.error(err); }
}

function renderGrid(rows, cols, thead, tbody) {
    // Header
    thead.innerHTML = `
        <tr class="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold">
            ${cols.map(c => `<th class="px-6 py-3 border-r border-slate-100 last:border-0">${c}</th>`).join('')}
            <th class="px-6 py-3 w-20 text-center">Actions</th>
        </tr>
    `;

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${cols.length + 1}" class="p-12 text-center text-slate-400 font-medium italic">Table is currently empty.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((r, idx) => `
        <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'} hover:bg-slate-50 transition-colors group">
            ${cols.map(c => `<td class="px-6 py-3 border-r border-slate-100 last:border-0 truncate max-w-[300px] font-mono text-[12px] text-slate-600">${r[c] !== null ? r[c] : '<span class="text-slate-300">null</span>'}</td>`).join('')}
            <td class="px-6 py-3 text-center">
                <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onclick='editRow(${JSON.stringify(r).replace(/'/g, "&apos;")})' class="p-1 text-slate-400 hover:text-blue-600" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onclick="deleteRow(${r.rowid})" class="p-1 text-slate-400 hover:text-red-600" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// --- CRUD Operations ---
let editingRowId = null;

async function showRowModal(existingData = null) {
    const { db, table, apiKey } = currentActive;
    el('rowModalTable').innerText = table;
    el('rowModalTitle').innerText = existingData ? 'Edit Row' : 'Insert Row';
    editingRowId = existingData ? existingData.rowid : null;

    // Get columns
    const res = await fetch('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ database: db, sql: `PRAGMA table_info("${table}")` })
    });
    const data = await res.json();
    const cols = data.rows || [];

    el('rowFields').innerHTML = cols.map(c => `
        <div class="space-y-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${c.name} <span class="text-slate-300 font-normal">(${c.type})</span></label>
            <input type="text" data-col="${c.name}" class="row-input w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:border-[#3ecf8e] text-sm" 
                value="${existingData ? (existingData[c.name] ?? '') : ''}" 
                ${c.pk && existingData ? 'disabled' : ''}
                placeholder="${c.dflt_value || 'NULL'}">
        </div>
    `).join('');

    el('rowModal').classList.remove('hidden');
}

function editRow(data) {
    showRowModal(data);
}

function deleteRow(rowid) {
    const { db, table, apiKey } = currentActive;
    showConfirm("Delete Row", "Are you sure you want to delete this row?", async () => {
        try {
            const res = await fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ database: db, sql: `DELETE FROM "${table}" WHERE rowid = ${rowid}` })
            });
            const d = await res.json();
            if (d.success) refreshTableData();
            else showNotify("Delete failed", d.error || d.detail, "error");
        } catch (e) { showNotify("Error", e.message, "error"); }
    });
}

async function submitRow() {
    const { db, table, apiKey } = currentActive;
    const inputs = Array.from(document.querySelectorAll('.row-input'));
    const data = {};
    inputs.forEach(input => {
        const col = input.getAttribute('data-col');
        data[col] = input.value;
    });

    let sql = "";
    if (editingRowId) {
        const sets = Object.keys(data).map(k => `"${k}" = ?`).join(', ');
        sql = `UPDATE "${table}" SET ${sets} WHERE rowid = ${editingRowId}`;
    } else {
        const cols = Object.keys(data).map(k => `"${k}"`).join(', ');
        const vals = Object.keys(data).map(() => '?').join(', ');
        sql = `INSERT INTO "${table}" (${cols}) VALUES (${vals})`;
    }

    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ 
                database: db, 
                sql: sql, 
                params: Object.values(data) 
            })
        });
        const d = await res.json();
        if (d.success) {
            el('rowModal').classList.add('hidden');
            refreshTableData();
            showNotify("Success", "Row saved successfully!");
        } else showNotify("Save failed", d.error || d.detail, "error");
    } catch (e) { showNotify("Error", e.message, "error"); }
}

async function runSql() {
    const sql = el('sqlInput').value;
    const { db, apiKey } = currentActive;
    if (!db) return showNotify("Required", "Please select a database from the sidebar.", "error");
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
    } catch (err) { showNotify("SQL Error", err.message, "error"); }
}

// --- 5. API Documentation Page ---
function showApiView() {
    const { db, table, apiKey } = currentActive;
    if (!db) return showNotify("Required", "Please select a database first.", "error");
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
            <div class="bg-emerald-50/50 rounded-2xl p-8 border border-emerald-100 shadow-sm relative overflow-hidden">
                <div class="absolute top-0 right-0 p-8 opacity-5 text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h3 class="text-lg font-bold mb-2 flex items-center gap-2 text-slate-900">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3m-3-3l-2.25-2.25"/></svg>
                    Security Best Practice: Environment Variables
                </h3>
                <p class="text-slate-500 text-sm mb-6 max-w-2xl">Never hardcode your API Key directly in your code. Store credentials in a <code class="text-emerald-600 font-bold">.env</code> file to prevent data leaks and maintain security.</p>
                <div class="code-block bg-white border-emerald-100 p-6 group shadow-none">
                    <button onclick="copyBlock(this)" class="absolute top-4 right-4 p-2 bg-white hover:bg-emerald-50 border border-emerald-100 rounded-md text-emerald-600 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5 text-[10px] font-bold shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        COPY .ENV
                    </button>
                    <pre class="text-emerald-700 font-mono text-sm leading-relaxed font-bold">SLITE_URL=${baseUrl}&#10;SLITE_API_KEY=${apiKey}&#10;SLITE_DB=${db}</pre>
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

// --- 6. Notification & Confirmation ---
function showNotify(title, text, type = 'success') {
    const iconEl = el('notifyIcon');
    const modalEl = el('notifyModal');
    
    el('notifyTitle').innerText = title;
    el('notifyText').innerText = text;
    
    if (type === 'success') {
        iconEl.className = "w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6";
        iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    } else {
        iconEl.className = "w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6";
        iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    }
    
    modalEl.classList.remove('hidden');
}

function showConfirm(title, text, onConfirm) {
    el('confirmTitle').innerText = title;
    el('confirmText').innerText = text;
    el('confirmModal').classList.remove('hidden');
    el('confirmBtn').onclick = () => {
        onConfirm();
        el('confirmModal').classList.add('hidden');
    };
}

// --- 7. Table Alterations & Deletion ---
async function submitAddColumn() {
    const colName = el('addColName').value.trim();
    const colType = el('addColType').value;
    const { db, table, apiKey } = currentActive;

    if (!colName) return showNotify("Required", "Column name is required.", "error");

    const sql = `ALTER TABLE "${table}" ADD COLUMN ${colName} ${colType}`;
    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql })
        });
        const data = await res.json();
        if (data.success) {
            el('addColName').value = '';
            refreshTableData();
            showNotify("Success", "Column added successfully!");
        } else showNotify("Error", data.error || data.detail || "Failed to add column", "error");
    } catch (err) { showNotify("System Error", err.message, "error"); }
}

function confirmDeleteTable() {
    const { db, table, apiKey } = currentActive;
    showConfirm(
        "Drop Table", 
        `Are you sure you want to delete table '${table}'? All data will be lost forever.`, 
        async () => {
            const sql = `DROP TABLE "${table}"`;
            try {
                const res = await fetch('/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ database: db, sql })
                });
                const data = await res.json();
                if (data.success) {
                    currentActive.table = '';
                    loadAllDatabases();
                    switchView('view-welcome');
                    showNotify("Success", "Table dropped.");
                } else showNotify("Error", data.error || data.detail, "error");
            } catch (err) { showNotify("Error", err.message, "error"); }
        }
    );
}

function confirmDeleteDb(name) {
    showConfirm(
        "Delete Database", 
        `Are you sure you want to delete database '${name}'? This will delete the actual .db file and its API key.`, 
        async () => {
            try {
                const res = await fetch('/admin/delete_db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dashToken}` },
                    body: JSON.stringify({ name })
                });
                const data = await res.json();
                if (data.success) {
                    if (currentActive.db === name) currentActive = { db: '', table: '', apiKey: '' };
                    loadAllDatabases();
                    switchView('view-welcome');
                    showNotify("Success", "Database deleted.");
                } else showNotify("Error", data.error || data.detail, "error");
            } catch (err) { showNotify("Error", err.message, "error"); }
        }
    );
}

// --- 8. Creation Modals ---
function showCreateDb() {
    el('newDbName').value = '';
    el('createDbModal').classList.remove('hidden');
    el('newDbName').focus();
}

async function submitCreateDb() {
    const name = el('newDbName').value.trim();
    if (!name) return showNotify("Required", "Database name is required.", "error");
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
            showNotify("Success", `Database '${name}' created.`);
        } else showNotify("Error", data.error || data.detail, "error");
    } catch (err) { showNotify("Error", err.message, "error"); }
}

function showCreateTable(db, apiKey) {
    currentActive = { db, table: '', apiKey };
    el('currentDbName').innerText = db;
    el('newTableName').value = '';
    el('columnList').innerHTML = '';
    // Initial PK column
    addColumnRow('id', 'INTEGER', true, false);
    addColumnRow('name', 'TEXT', false, true);
    el('createTableModal').classList.remove('hidden');
}

function addColumnRow(name = '', type = 'TEXT', pk = false, nullable = true) {
    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-100 last:border-0 group";
    tr.innerHTML = `
        <td class="p-2">
            <input type="text" class="col-name w-full px-3 py-1.5 bg-white border border-slate-200 rounded outline-none focus:border-[#3ecf8e] text-[13px]" placeholder="column_name" value="${name}">
        </td>
        <td class="p-2">
            <select class="col-type w-full px-2 py-1.5 bg-white border border-slate-200 rounded outline-none focus:border-[#3ecf8e] text-[12px] font-medium">
                <option value="INTEGER" ${type === 'INTEGER' ? 'selected' : ''}>INTEGER</option>
                <option value="TEXT" ${type === 'TEXT' ? 'selected' : ''}>TEXT</option>
                <option value="REAL" ${type === 'REAL' ? 'selected' : ''}>REAL</option>
                <option value="BLOB" ${type === 'BLOB' ? 'selected' : ''}>BLOB</option>
                <option value="DATETIME" ${type === 'DATETIME' ? 'selected' : ''}>DATETIME</option>
            </select>
        </td>
        <td class="p-2 text-center">
            <input type="checkbox" class="col-pk w-4 h-4 rounded border-slate-300 text-[#3ecf8e] focus:ring-[#3ecf8e]" ${pk ? 'checked' : ''}>
        </td>
        <td class="p-2 text-center">
            <input type="checkbox" class="col-nullable w-4 h-4 rounded border-slate-300 text-[#3ecf8e] focus:ring-[#3ecf8e]" ${nullable ? 'checked' : ''}>
        </td>
        <td class="p-2 text-center">
            <button onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </td>
    `;
    el('columnList').appendChild(tr);
}

async function submitCreateTable() {
    const tableName = el('newTableName').value.trim();
    if (!tableName) return showNotify("Required", "Please enter a table name.", "error");

    const rows = Array.from(el('columnList').querySelectorAll('tr'));
    if (rows.length === 0) return showNotify("Required", "Please add at least one column.", "error");

    const columnDefs = rows.map(tr => {
        const name = tr.querySelector('.col-name').value.trim();
        const type = tr.querySelector('.col-type').value;
        const isPk = tr.querySelector('.col-pk').checked;
        const isNullable = tr.querySelector('.col-nullable').checked;

        if (!name) return null;

        let def = `${name} ${type}`;
        if (isPk) def += " PRIMARY KEY";
        if (isPk && type === 'INTEGER') def += " AUTOINCREMENT";
        if (!isNullable && !isPk) def += " NOT NULL";
        
        return def;
    }).filter(d => d !== null);

    if (columnDefs.length === 0) return showNotify("Required", "Please provide names for your columns.", "error");

    const sql = `CREATE TABLE "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
    
    const { db, apiKey } = currentActive;
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
            showTable(db, tableName, apiKey);
            showNotify("Success", `Table '${tableName}' created.`);
        } else {
            showNotify("Create Table Error", data.error || data.detail || "Check your schema definition.", "error");
        }
    } catch (err) {
        showNotify("Failed", err.message, "error");
    }
}
