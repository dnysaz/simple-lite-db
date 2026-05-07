let dashToken = '';
let allDatabases = [];
let currentActive = { db: '', table: '', apiKey: '' };

const el = (id) => document.getElementById(id);

// --- Initialization ---
document.getElementById('serverTime').innerText = new Date().toLocaleString();

// --- 1. Login Logic ---
el('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const username = el('username').value;
    const password = el('password').value;
    
    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.detail);

        dashToken = data.token;
        el('loginOverlay').classList.add('hidden');
        el('userDisplay').innerText = `Logged in as: ${username}`;
        loadAllDatabases();
    } catch (err) {
        el('loginError').innerText = "❌ " + err.message;
        el('loginError').classList.remove('hidden');
    }
};

// --- 2. Database Explorer ---
async function loadAllDatabases() {
    try {
        const res = await fetch('/admin/databases', {
            headers: { 'Authorization': `Bearer ${dashToken}` }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.detail);

        allDatabases = data.databases;
        renderSidebar();
    } catch (err) { alert("❌ Failed to load databases: " + err.message); }
}

async function renderSidebar() {
    const list = el('sidebarContent');
    list.innerHTML = '';

    for (const db of allDatabases) {
        const dbDiv = document.createElement('div');
        dbDiv.className = "mb-1";
        
        // Fetch tables for this db
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
            <div class="db-tree-item font-bold text-gray-700" onclick="showSqlTab('${db.name}', '${db.api_key}')">
                <span>➕</span> <span class="truncate">${db.name}</span>
            </div>
            <div class="space-y-[1px]">
                ${tables.map(t => `
                    <div class="table-node text-[11px] cursor-pointer" onclick="showTable('${db.name}', '${t.name}', '${db.api_key}')">
                        <span>📄</span> <span class="truncate">${t.name}</span>
                    </div>
                `).join('')}
            </div>
        `;
        list.appendChild(dbDiv);
    }
}

// --- 3. View Management ---
function switchView(viewId) {
    ['view-welcome', 'view-table', 'view-sql'].forEach(id => el(id).classList.add('hidden'));
    el(viewId).classList.remove('hidden');
    
    // Reset active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (viewId === 'view-welcome') document.querySelector('.tab-btn:first-child').classList.add('active');
}

async function showTable(db, table, apiKey) {
    currentActive = { db, table, apiKey };
    el('breadcrumb').innerHTML = `<span class="text-gray-400 font-normal">Database:</span> ${db} <span class="text-gray-300 mx-2">&raquo;</span> <span class="text-gray-400 font-normal">Table:</span> ${table}`;
    switchView('view-table');
    el('browseTabBtn').classList.remove('hidden');
    el('browseTabBtn').classList.add('active');
    refreshTableData();
}

function showSqlTab(dbName = '', apiKey = '') {
    if (dbName) currentActive = { db: dbName, table: '', apiKey };
    el('sqlTargetDb').innerText = currentActive.db || "(no database selected)";
    switchView('view-sql');
    el('sqlTabBtn').classList.add('active');
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
    } catch (err) { alert(err.message); }
}

function renderGrid(rows, thead, tbody) {
    if (!rows || rows.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td class="p-8 text-center text-gray-400 italic">Table is empty or no results returned.</td></tr>';
        return;
    }
    const cols = Object.keys(rows[0]);
    thead.innerHTML = `<tr>${cols.map(c => `<th class="p-2 border-r border-gray-200 last:border-0">${c}</th>`).join('')}</tr>`;
    tbody.innerHTML = rows.map((r, idx) => `
        <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50 transition-colors">
            ${cols.map(c => `<td class="p-2 border-r border-gray-200 last:border-0 font-mono text-[11px] truncate max-w-[250px]">${r[c]}</td>`).join('')}
        </tr>
    `).join('');
}

async function runSql() {
    const sql = el('sqlInput').value;
    const { db, apiKey } = currentActive;
    if (!db) return alert("Please select a database first!");
    
    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        el('sqlResult').classList.remove('hidden');
        el('sqlResult').innerHTML = '<div class="overflow-x-auto"><table class="w-full text-left border-collapse text-xs"><thead id="sthead" class="bg-gray-100 border-b border-gray-300 font-bold"></thead><tbody id="stbody" class="divide-y divide-gray-200"></tbody></table></div>';
        renderGrid(data.rows, el('sthead'), el('stbody'));
        
        // Refresh sidebar for CREATE/DROP
        if (sql.toUpperCase().match(/CREATE|DROP|ALTER/)) loadAllDatabases();
    } catch (err) { alert("⚠️ SQL Error: " + err.message); }
}

async function showCreateDb() {
    const name = prompt("Enter new database name:");
    if (!name) return;
    try {
        const res = await fetch('/admin/create_db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dashToken}` },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.success) {
            alert(`✅ Database ${data.name} created!`);
            loadAllDatabases();
        } else alert("❌ Error: " + data.error);
    } catch (err) { alert(err.message); }
}
