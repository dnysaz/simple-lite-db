// SimpleLiteDB Explorer v4.0 - Core Logic
let dashToken = localStorage.getItem('slite_token');
let allDatabases = [];
let currentActive = { db: '', table: '', apiKey: '' };
let lastView = 'view-welcome';

const el = (id) => document.getElementById(id);

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

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
let expandedDbs = new Set();

function toggleDbNode(name, e) {
    if (e) e.stopPropagation();
    if (expandedDbs.has(name)) expandedDbs.delete(name);
    else expandedDbs.add(name);
    renderSidebar();
}

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

    if (myRenderId !== sidebarRenderId) return;

    const list = el('sidebarContent');
    let finalHtml = '';
    let gridHtml = '';

    for (const db of dbData) {
        const isActiveDb = currentActive.db === db.name;
        const isExpanded = expandedDbs.has(db.name);

        finalHtml += `
            <div class="mb-1">
                <div class="db-node ${isActiveDb ? 'active' : ''} group" onclick="showSqlTab('${db.name}', '${db.api_key}')">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <button onclick="toggleDbNode('${db.name}', event)" class="p-0.5 hover:bg-slate-100 rounded transition-all text-slate-400">
                            ${isExpanded ? 
                                '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>' : 
                                '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
                            }
                        </button>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isActiveDb ? 'text-[#3ecf8e]' : 'text-slate-400 group-hover:text-slate-600'}"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                        <span class="truncate font-medium text-slate-700">${db.name}</span>
                    </div>
                    <div class="flex items-center gap-1 transition-all ml-2">
                        <button onclick="event.stopPropagation(); showCreateTable('${db.name}', '${db.api_key}')" class="p-0.5 hover:bg-emerald-50 text-emerald-600 border border-transparent hover:border-emerald-200 rounded transition-all" title="New Table">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <button onclick="event.stopPropagation(); confirmDeleteDb('${db.name}')" class="p-0.5 hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200 rounded transition-all" title="Delete Database">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                    </div>
                </div>
                
                <div class="mt-0.5 ml-4 border-l border-slate-100 ${isExpanded ? '' : 'hidden'}">
                    ${db.tables.length === 0 ? '<div class="px-6 py-1 text-[10px] text-slate-300 italic">No tables</div>' : ''}
                    ${db.tables.map(t => {
                        const isActiveTable = currentActive.db === db.name && currentActive.table === t.name;
                        return `
                        <div class="table-node ${isActiveTable ? 'active' : ''}" onclick="showTable('${db.name}', '${t.name}', '${db.api_key}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-40"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                            <span class="truncate text-slate-500">${t.name}</span>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        // Home Grid Html
        gridHtml += `
            <div class="group bg-white border border-slate-100 p-6 rounded-2xl hover:bg-emerald-50/10 hover:border-[#3ecf8e] transition-all cursor-pointer" onclick="showSqlTab('${db.name}', '${db.api_key}')">
                <div class="flex justify-between items-start mb-6">
                    <div class="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-[#3ecf8e]/10 group-hover:text-[#3ecf8e] transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                    </div>
                    <div class="text-[10px] font-black text-slate-300 uppercase tracking-widest">${formatBytes(db.size)}</div>
                </div>
                <h3 class="text-xl font-bold text-slate-900 mb-1 truncate">${db.name}</h3>
                <p class="text-xs text-slate-400 font-medium">${db.tables.length} Tables</p>
                <div class="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span class="text-[10px] font-bold text-[#3ecf8e] opacity-0 group-hover:opacity-100 transition-all">OPEN DATABASE →</span>
                    <div class="flex items-center gap-1">
                        <button onclick="event.stopPropagation(); showCreateTable('${db.name}', '${db.api_key}')" class="p-1.5 hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 rounded-lg transition-all" title="New Table">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <button onclick="event.stopPropagation(); confirmDeleteDb('${db.name}')" class="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-all" title="Delete Database">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    list.innerHTML = finalHtml || '<div class="p-8 text-center text-slate-400 text-xs italic">No databases created yet</div>';
    
    const gridContainer = el('db-grid-content');
    if (gridContainer) {
        gridContainer.innerHTML = gridHtml || `
            <div class="col-span-full py-16 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                <div class="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300 border border-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                </div>
                <p class="text-slate-500 text-sm font-bold mb-6">No databases found.</p>
                <button onclick="showCreateDb()" class="px-6 py-2.5 bg-[#3ecf8e] hover:bg-[#34b27b] text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95">
                    + CREATE FIRST DATABASE
                </button>
            </div>
        `;
    }
}

// --- 4. Views & Actions ---
function switchView(viewId) {
    if (viewId !== 'view-api' && viewId !== 'view-relation' && viewId !== 'view-terminal') lastView = viewId;
    ['view-welcome', 'view-table', 'view-sql', 'view-api', 'view-relation', 'view-terminal'].forEach(id => {
        const item = el(id);
        if (item) item.classList.add('hidden');
    });
    el(viewId).classList.remove('hidden');
    
    // Toggle Top Action Bar
    if (viewId === 'view-table' || viewId === 'view-sql' || viewId === 'view-relation') {
        el('viewActions').classList.remove('hidden');
    } else {
        el('viewActions').classList.add('hidden');
    }

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    const navs = document.querySelectorAll('.nav-link');
    if (viewId === 'view-welcome' && navs[0]) navs[0].classList.add('active');
    if (viewId === 'view-sql' && navs[1]) navs[1].classList.add('active');
    if (viewId === 'view-relation' && navs[2]) navs[2].classList.add('active');
    if (viewId === 'view-terminal' && navs[3]) navs[3].classList.add('active');
    if (viewId === 'view-api' && navs[4]) navs[4].classList.add('active');
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
        container.innerHTML = `<div id="mermaid-parent" class="w-full h-[800px] border border-slate-100 rounded-xl bg-slate-50/20 overflow-hidden cursor-move relative">
            <pre class="mermaid w-full h-full">${erString}</pre>
        </div>`;
        
        mermaid.initialize({ 
            startOnLoad: true, 
            theme: 'base',
            er: { useMaxWidth: false },
            themeVariables: {
                primaryColor: '#ffffff',
                primaryTextColor: '#0f172a',
                primaryBorderColor: '#cbd5e1',
                lineColor: '#3ecf8e',
                secondaryColor: '#f8fafc',
                tertiaryColor: '#ffffff'
            }
        });
        
        await mermaid.run();

        // 4. Initialize Pan/Zoom
        const svg = container.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.style.maxWidth = '100%';
            
            const panZoom = svgPanZoom(svg, {
                zoomEnabled: true,
                controlIconsEnabled: true,
                fit: false,
                center: true,
                minZoom: 0.1,
                maxZoom: 20,
                refreshRate: 'auto'
            });

            panZoom.zoom(1.0); // Set natural zoom by default
            panZoom.center();

            // Re-fit on window resize
            window.addEventListener('resize', () => panZoom.resize());
        }

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
        loadColumnSettings();
    }
}

async function loadColumnSettings() {
    const { db, table, apiKey } = currentActive;
    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql: `PRAGMA table_info("${table}")` })
        });
        const data = await res.json();
        const cols = data.rows || [];
        
        el('columnEditorList').innerHTML = '';
        cols.forEach(c => addNewColumnRow(c));
    } catch (e) { console.error(e); }
}

function addNewColumnRow(c = null) {
    const tr = document.createElement('tr');
    tr.className = "group hover:bg-slate-50/50 transition-colors";
    tr.dataset.originalName = c ? c.name : "";
    
    tr.innerHTML = `
        <td class="px-4 py-3 text-center">
            <div class="flex flex-col gap-1 items-center">
                <button onclick="moveCol(this, -1)" class="p-1 text-slate-300 hover:text-slate-600"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>
                <button onclick="moveCol(this, 1)" class="p-1 text-slate-300 hover:text-slate-600"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
            </div>
        </td>
        <td class="px-4 py-3">
            <input type="text" class="col-name w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:border-[#3ecf8e]" value="${c ? c.name : ''}" placeholder="column_name">
        </td>
        <td class="px-4 py-3">
            <select class="col-type w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:border-[#3ecf8e]">
                <option value="INTEGER" ${c && c.type.startsWith('INT') ? 'selected' : ''}>INTEGER (ID, Numbers)</option>
                <option value="TEXT" ${c && c.type === 'TEXT' ? 'selected' : ''}>TEXT (Long String)</option>
                <option value="VARCHAR" ${c && c.type.startsWith('VAR') ? 'selected' : ''}>VARCHAR (String)</option>
                <option value="BOOLEAN" ${c && c.type === 'BOOLEAN' ? 'selected' : ''}>BOOLEAN (True/False)</option>
                <option value="DATE" ${c && c.type === 'DATE' ? 'selected' : ''}>DATE</option>
                <option value="DATETIME" ${c && c.type === 'DATETIME' ? 'selected' : ''}>DATETIME</option>
                <option value="REAL" ${c && c.type === 'REAL' ? 'selected' : ''}>REAL (Decimal)</option>
                <option value="NUMERIC" ${c && c.type === 'NUMERIC' ? 'selected' : ''}>NUMERIC</option>
                <option value="BLOB" ${c && c.type === 'BLOB' ? 'selected' : ''}>BLOB (Binary)</option>
            </select>
        </td>
        <td class="px-4 py-3 text-center">
            <input type="checkbox" class="col-pk w-4 h-4 rounded border-slate-300 text-[#3ecf8e]" ${c && c.pk ? 'checked' : ''}>
        </td>
        <td class="px-4 py-3 text-center">
            <input type="checkbox" class="col-null w-4 h-4 rounded border-slate-300 text-[#3ecf8e]" ${c && !c.notnull ? 'checked' : ''}>
        </td>
        <td class="px-4 py-3 text-center">
            <button onclick="this.closest('tr').remove()" class="p-1.5 text-slate-300 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </td>
    `;
    el('columnEditorList').appendChild(tr);
}

function moveCol(btn, dir) {
    const row = btn.closest('tr');
    if (dir === -1 && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
    if (dir === 1 && row.nextElementSibling) row.parentNode.insertBefore(row, row.nextElementSibling.nextElementSibling);
}

async function saveTableSchema() {
    const { db, table, apiKey } = currentActive;
    const rows = Array.from(el('columnEditorList').querySelectorAll('tr'));
    
    if (rows.length === 0) return showNotify("Error", "Table must have at least one column.", "error");

    const newCols = rows.map(tr => ({
        name: tr.querySelector('.col-name').value.trim(),
        type: tr.querySelector('.col-type').value,
        pk: tr.querySelector('.col-pk').checked,
        notnull: !tr.querySelector('.col-null').checked,
        oldName: tr.dataset.originalName
    }));

    if (newCols.some(c => !c.name)) return showNotify("Error", "All columns must have a name.", "error");

    showConfirm("Apply Schema Changes", "This will recreate the table to apply changes. All existing data will be migrated.", async () => {
        try {
            // 1. Build Create Table SQL
            const colDefs = newCols.map(c => {
                let d = `"${c.name}" ${c.type}`;
                if (c.pk) d += " PRIMARY KEY";
                if (c.pk && c.type === 'INTEGER') d += " AUTOINCREMENT";
                if (c.notnull && !c.pk) d += " NOT NULL";
                return d;
            }).join(', ');

            const tempTableName = `${table}_old_${Date.now()}`;
            
            // 2. Transaction Sequence
            const sqlSequence = [
                `PRAGMA foreign_keys=OFF`,
                `BEGIN TRANSACTION`,
                `ALTER TABLE "${table}" RENAME TO "${tempTableName}"`,
                `CREATE TABLE "${table}" (${colDefs})`,
                `INSERT INTO "${table}" (${newCols.map(c => `"${c.name}"`).join(', ')}) 
                 SELECT ${newCols.map(c => c.oldName ? `"${c.oldName}"` : 'NULL').join(', ')} 
                 FROM "${tempTableName}"`,
                `DROP TABLE "${tempTableName}"`,
                `COMMIT`,
                `PRAGMA foreign_keys=ON`
            ];

            // Execute as one block if possible, or sequence
            // For safety, we send them one by one or join with semicolon if API supports it
            // Our /query endpoint supports single statements usually, but let's try joining
            const res = await fetch('/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ database: db, sql: sqlSequence.join('; ') })
            });
            const d = await res.json();
            
            if (d.success) {
                showNotify("Success", "Table schema updated successfully.");
                loadColumnSettings();
                refreshTableData();
            } else {
                showNotify("Schema Update Failed", d.error || "Check your column names/types.", "error");
            }
        } catch (e) { showNotify("Error", e.message, "error"); }
    });
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
    updateSqlTableList();
    switchView('view-sql');
    renderSidebar();
}

async function updateSqlTableList() {
    const listEl = el('sql-table-list');
    if (!listEl) return;
    if (!currentActive.db) {
        listEl.innerHTML = '<span class="text-slate-300 text-[10px] italic">Please select a database from the sidebar</span>';
        return;
    }

    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentActive.apiKey}` },
            body: JSON.stringify({ database: currentActive.db, sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'" })
        });
        const data = await res.json();
        const tables = data.rows || [];
        
        if (tables.length === 0) {
            listEl.innerHTML = '<span class="text-slate-300 text-[10px] italic">No tables in this database</span>';
            return;
        }

        listEl.innerHTML = '<span class="text-[9px] font-black text-slate-300 uppercase tracking-tighter mr-2 pt-1">Tables:</span>' + 
            tables.map(t => `
            <button onclick="insertTableName('${t.name}')" class="px-2 py-0.5 bg-white border border-slate-100 rounded text-[10px] font-bold text-slate-500 hover:border-[#3ecf8e] hover:text-[#3ecf8e] transition-all">
                ${t.name}
            </button>
        `).join('');
    } catch (e) {
        listEl.innerHTML = '<span class="text-red-300 text-[10px] italic">Failed to load tables</span>';
    }
}

function insertTableName(name) {
    const input = el('sqlInput');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    input.value = text.substring(0, start) + name + text.substring(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + name.length;
}

async function refreshTableData() {
    const { db, table, apiKey } = currentActive;
    if (!db || !table) return;
    try {
        // Fetch Schema first
        const schemaRes = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql: `PRAGMA table_info("${table}")` })
        });
        const schemaData = await schemaRes.json();
        const schemaCols = schemaData.rows || [];

        // Fetch data
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql: `SELECT rowid AS _rowid_, * FROM "${table}" LIMIT 100` })
        });
        const data = await res.json();
        let rows = data.rows || [];

        renderGrid(rows, schemaCols, el('thead'), el('tbody'));
    } catch (err) { console.error(err); }
}

function renderGrid(rows, schemaCols, thead, tbody) {
    // Header
    thead.innerHTML = `
        <tr class="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold">
            ${schemaCols.map(c => `
                <th class="px-6 py-3 border-r border-slate-100 last:border-0">
                    <div class="flex flex-col gap-0.5">
                        <span class="text-slate-900">${c.name}</span>
                        <div class="flex items-center gap-1">
                            <span class="text-[9px] text-slate-400 font-mono normal-case">${c.type}</span>
                            ${c.pk ? '<span class="text-[8px] bg-emerald-100 text-[#3ecf8e] px-1 rounded">PK</span>' : ''}
                            ${!c.notnull && !c.pk ? '<span class="text-[8px] text-slate-300 normal-case">null</span>' : ''}
                        </div>
                    </div>
                </th>
            `).join('')}
            <th class="px-6 py-3 w-20 text-center">Actions</th>
        </tr>
    `;

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${schemaCols.length + 1}" class="p-12 text-center text-slate-400 font-medium italic">Table is currently empty.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((r, idx) => `
        <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'} hover:bg-slate-50 transition-colors group">
            ${schemaCols.map(c => `
                <td class="px-6 py-3 border-r border-slate-100 last:border-0 truncate max-w-[300px] font-mono text-[12px] text-slate-600">
                    ${r[c.name] !== null ? r[c.name] : '<span class="text-slate-300 italic">null</span>'}
                </td>
            `).join('')}
            <td class="px-6 py-3 text-center">
                <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onclick='editRow(${JSON.stringify(r).replace(/'/g, "&apos;")})' class="p-1 text-slate-400 hover:text-blue-600" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onclick="deleteRow(${r._rowid_})" class="p-1 text-slate-400 hover:text-red-600" title="Delete">
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
    editingRowId = existingData ? existingData._rowid_ : null;

    // Get columns
    const res = await fetch('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ database: db, sql: `PRAGMA table_info("${table}")` })
    });
    const data = await res.json();
    const cols = data.rows || [];

    el('rowFields').innerHTML = cols.map(c => {
        const isPk = c.pk;
        const isInserting = !existingData;
        const isDisabled = (isPk && !isInserting) || (isPk && isInserting); // We disable PK on both for now to ensure system handles it
        
        return `
        <div class="space-y-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                ${c.name} 
                <span class="text-slate-300 font-normal">(${c.type})</span>
                ${isPk ? '<span class="ml-2 text-[#3ecf8e] text-[9px] bg-emerald-50 px-1.5 py-0.5 rounded">AUTO-GENERATED</span>' : ''}
            </label>
            <input type="text" data-col="${c.name}" class="row-input w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:border-[#3ecf8e] text-sm" 
                value="${existingData ? (existingData[c.name] ?? '') : ''}" 
                ${isDisabled ? 'disabled' : ''}
                placeholder="${isPk ? 'Will be assigned by system' : (c.dflt_value || 'NULL')}">
        </div>
        `;
    }).join('');

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
                body: JSON.stringify({ database: db, sql: `DELETE FROM "${table}" WHERE rowid = ?`, params: [rowid] })
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
    const updateData = {};
    const insertData = {};
    
    inputs.forEach(input => {
        const col = input.getAttribute('data-col');
        if (!input.disabled) {
            updateData[col] = input.value;
            insertData[col] = input.value;
        }
    });

    let sql = "";
    let params = [];

    if (editingRowId !== null) {
        // UPDATE MODE
        const sets = Object.keys(updateData).map(k => `"${k}" = ?`).join(', ');
        if (!sets) return el('rowModal').classList.add('hidden');
        sql = `UPDATE "${table}" SET ${sets} WHERE rowid = ?`;
        params = [...Object.values(updateData), editingRowId];
    } else {
        // INSERT MODE
        const cols = Object.keys(insertData).map(k => `"${k}"`).join(', ');
        const vals = Object.keys(insertData).map(() => '?').join(', ');
        sql = `INSERT INTO "${table}" (${cols}) VALUES (${vals})`;
        params = Object.values(insertData);
    }

    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql, params })
        });
        const d = await res.json();
        if (d.success) {
            el('rowModal').classList.add('hidden');
            refreshTableData();
            showNotify("Success", editingRowId !== null ? "Row updated!" : "Row inserted!");
            editingRowId = null; // Reset
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
        
        const rows = data.rows || [];
        const cols = rows.length > 0 ? Object.keys(rows[0]).map(k => ({ name: k, type: '' })) : [];
        
        renderGrid(rows, cols, el('sthead'), el('stbody'));
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
    const activeDb = db || currentActive.db;
    const activeKey = apiKey || currentActive.apiKey;

    if (!activeDb) {
        showNotify("Error", "Please select a database first", "error");
        return;
    }

    currentActive.db = activeDb;
    currentActive.apiKey = activeKey;
    
    el('currentDbName').innerText = activeDb;
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
                <option value="INTEGER" ${type === 'INTEGER' ? 'selected' : ''}>INTEGER (ID, Numbers)</option>
                <option value="TEXT" ${type === 'TEXT' ? 'selected' : ''}>TEXT (Long String)</option>
                <option value="VARCHAR(255)" ${type.startsWith('VARCHAR') ? 'selected' : ''}>VARCHAR (String)</option>
                <option value="BOOLEAN" ${type === 'BOOLEAN' ? 'selected' : ''}>BOOLEAN (True/False)</option>
                <option value="DATE" ${type === 'DATE' ? 'selected' : ''}>DATE</option>
                <option value="DATETIME" ${type === 'DATETIME' ? 'selected' : ''}>DATETIME</option>
                <option value="REAL" ${type === 'REAL' ? 'selected' : ''}>REAL (Decimal)</option>
                <option value="NUMERIC" ${type === 'NUMERIC' ? 'selected' : ''}>NUMERIC</option>
                <option value="BLOB" ${type === 'BLOB' ? 'selected' : ''}>BLOB (Binary)</option>
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

// --- 9. Integrated Terminal View ---
let terminalHistory = [];
let terminalHistoryIdx = -1;
let isTerminalInitialized = false;

function showTerminalView() {
    switchView('view-terminal');
    if (!isTerminalInitialized) {
        initTerminal();
        isTerminalInitialized = true;
        // Auto show help
        processTerminalCommand('HELP');
    }
    el('terminal-input').focus();
}

function initTerminal() {
    const input = el('terminal-input');
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const cmd = input.value.trim();
            if (!cmd) return;
            
            terminalHistory.push(cmd);
            terminalHistoryIdx = terminalHistory.length;
            input.value = '';
            
            await processTerminalCommand(cmd);
        } else if (e.key === 'ArrowUp') {
            if (terminalHistoryIdx > 0) {
                terminalHistoryIdx--;
                input.value = terminalHistory[terminalHistoryIdx];
            }
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (terminalHistoryIdx < terminalHistory.length - 1) {
                terminalHistoryIdx++;
                input.value = terminalHistory[terminalHistoryIdx];
            } else {
                terminalHistoryIdx = terminalHistory.length;
                input.value = '';
            }
            e.preventDefault();
        }
    });
}

async function processTerminalCommand(cmd) {
    const output = el('terminal-output');
    const log = (msg, type = 'res') => {
        const div = document.createElement('div');
        div.className = `mb-2 ${type === 'cmd' ? 'text-slate-400 mt-4' : type === 'error' ? 'text-red-600 font-bold' : type === 'success' ? 'text-[#3ecf8e] font-bold' : 'text-slate-700'}`;
        div.innerHTML = msg;
        output.appendChild(div);
        output.scrollTop = output.scrollHeight;
    };

    log(`slite> ${cmd}`, 'cmd');
    
    const upper = cmd.toUpperCase().trim();
    const parts = cmd.split(' ');

    if (upper === 'HELP') {
        log(`
<span class="text-slate-900 font-bold text-base">SimpleLiteDB Shell v1.0.0</span>
Type SQLite commands directly or use the administrative helpers below.

<span class="text-blue-600 font-bold">--- ADMIN COMMANDS ---</span>
  <span class="text-slate-900 font-bold">LIST DATABASES</span>           Show all databases and their API keys.
  <span class="text-slate-900 font-bold">USE &lt;db_name&gt;</span>            Switch the active database context.
  <span class="text-slate-900 font-bold">CREATE DATABASE &lt;name&gt;</span>   Initialize a new SQLite database instance.
  <span class="text-slate-900 font-bold">DELETE DATABASE &lt;name&gt;</span>   Permanently delete a database and its key.

<span class="text-emerald-600 font-bold">--- SQL COMMANDS ---</span>
  <span class="text-slate-900 font-bold">LIST TABLES</span>              Show all tables in active DB.
  <span class="text-slate-900 font-bold">DESC &lt;table_name&gt;</span>         Show columns/schema of a table.
  Supports standard SQLite syntax (SELECT, INSERT, UPDATE, etc.)
  Example: <span class="text-slate-400">SELECT * FROM users;</span>

<span class="text-slate-500 font-bold">--- SYSTEM ---</span>
  <span class="text-slate-900 font-bold">CLEAR</span>                    Clear the terminal screen.
  <span class="text-slate-900 font-bold">HELP</span>                     Show this menu.
        `);
    } else if (upper === 'CLEAR') {
        output.innerHTML = '';
    } else if (upper === 'LIST DATABASES') {
        await listDatabasesTerminal(log);
    } else if (upper === 'LIST TABLES') {
        await runSqlTerminal(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`, log);
    } else if (upper.startsWith('DESC ')) {
        await runSqlTerminal(`PRAGMA table_info("${parts[1]}")`, log);
    } else if (upper.startsWith('USE ')) {
        await useDatabaseTerminal(parts[1], log);
    } else if (upper.startsWith('CREATE DATABASE ')) {
        await createDatabaseTerminal(parts[2], log);
    } else if (upper.startsWith('DELETE DATABASE ')) {
        await deleteDatabaseTerminal(parts[2], log);
    } else {
        // Standard SQL
        await runSqlTerminal(cmd, log);
    }
}

async function listDatabasesTerminal(log) {
    const token = localStorage.getItem('slite_token');
    try {
        const res = await fetch('/admin/databases', { headers: { 'Authorization': `Bearer ${token}` } });
        const d = await res.json();
        if (d.success) {
            let table = `<table class="w-full border-collapse border border-slate-200 text-[11px] mt-2 bg-white rounded-lg overflow-hidden shadow-sm">
                <tr class="bg-slate-100">
                    <th class="border border-slate-200 p-2 text-left text-slate-900 font-bold">DB Name</th>
                    <th class="border border-slate-200 p-2 text-left text-slate-900 font-bold">API Key</th>
                </tr>`;
            d.databases.forEach(db => {
                table += `<tr class="hover:bg-slate-50"><td class="border border-slate-200 p-2 text-slate-700 font-medium">${db.name}</td><td class="border border-slate-200 p-2 text-slate-400 font-mono text-[10px]">${db.api_key}</td></tr>`;
            });
            table += `</table>`;
            log(table);
        } else log(d.error, 'error');
    } catch (e) { log(e.message, 'error'); }
}

async function useDatabaseTerminal(name, log) {
    if (!name) return log("Error: Specify database name", "error");
    const token = localStorage.getItem('slite_token');
    try {
        const res = await fetch('/admin/databases', { headers: { 'Authorization': `Bearer ${token}` } });
        const d = await res.json();
        const db = d.databases.find(x => x.name.toLowerCase() === name.toLowerCase());
        if (db) {
            currentActive = { db: db.name, table: '', apiKey: db.api_key };
            renderSidebar();
            log(`Active context: <span class="text-white">${db.name}</span>`, 'success');
        } else log(`Database '${name}' not found.`, 'error');
    } catch (e) { log(e.message, 'error'); }
}

async function createDatabaseTerminal(name, log) {
    if (!name) return log("Error: Specify database name", "error");
    const token = localStorage.getItem('slite_token');
    try {
        const res = await fetch('/admin/create_db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        const d = await res.json();
        if (d.success) {
            log(`Database '${d.name}' created successfully.`, 'success');
            // Auto-switch to the new DB
            currentActive = { db: d.name, table: '', apiKey: d.api_key };
            renderSidebar();
            log(`Active context: <span class="text-slate-900 font-bold">${d.name}</span>`, 'success');
            loadAllDatabases();
        } else log(d.error, 'error');
    } catch (e) { log(e.message, 'error'); }
}

async function deleteDatabaseTerminal(name, log) {
    if (!name) return log("Error: Specify database name", "error");
    if (!confirm(`Delete database '${name}'? This cannot be undone.`)) return;
    const token = localStorage.getItem('slite_token');
    try {
        const res = await fetch('/admin/delete_db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        const d = await res.json();
        if (d.success) {
            log(`Database '${name}' deleted.`, 'success');
            loadAllDatabases();
        } else log(d.error, 'error');
    } catch (e) { log(e.message, 'error'); }
}

async function runSqlTerminal(sql, log) {
    const { db, apiKey } = currentActive;
    if (!db) return log("Error: No database selected. Use 'USE &lt;db_name&gt;' first.", "error");
    try {
        const res = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ database: db, sql })
        });
        const d = await res.json();
        if (d.success) {
            if (d.rows && d.rows.length > 0) {
                const cols = Object.keys(d.rows[0]);
                let table = `<table class="w-full border-collapse border border-slate-200 text-[11px] mt-2 bg-white rounded-lg overflow-hidden shadow-sm">
                    <tr class="bg-slate-100 text-slate-900">`;
                cols.forEach(c => table += `<th class="border border-slate-200 p-2 text-left font-bold">${c}</th>`);
                table += `</tr>`;
                d.rows.forEach(r => {
                    table += `<tr class="hover:bg-slate-50">`;
                    cols.forEach(c => table += `<td class="border border-slate-200 p-2 font-mono text-slate-600">${r[c] !== null ? r[c] : '<span class="text-slate-300">null</span>'}</td>`);
                    table += `</tr>`;
                });
                table += `</table>`;
                log(table);
            } else log("Query OK. 0 rows returned.", "success");
            
            // Refresh sidebar if schema changed
            if (sql.toUpperCase().match(/CREATE|DROP|ALTER/)) {
                loadAllDatabases();
            }
        } else log(d.error, 'error');
    } catch (e) { log(e.message, 'error'); }
}
