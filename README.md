# 🚀 SimpleLiteDB

**SimpleLiteDB** is a lightweight, self-hosted **"SQLite over HTTP"** service. It allows serverless applications (like Next.js on Vercel) to use a persistent SQLite database hosted on your own VPS via a simple HTTP API with raw SQL.

No ORM. No complex setup. Just **standard SQL over fetch()**.

---

## ✨ Why SimpleLiteDB?

Vercel and other serverless platforms have **ephemeral filesystems** — SQLite files don't persist. SimpleLiteDB solves this by hosting SQLite on your VPS and exposing it via HTTP.

- **Standard SQL**: Write `SELECT`, `INSERT`, `JOIN`, `FOREIGN KEY` — all native SQLite syntax.
- **Vercel Friendly**: Access your database from serverless functions using `fetch()`.
- **Multi-Database**: Manage multiple isolated databases, each with its own API key.
- **WAL Mode**: Built-in Write-Ahead Logging for better read/write concurrency.
- **Secure**: Per-database API keys, dangerous SQL blocking, and parameterized queries.
- **Lightweight**: Just Python + FastAPI. No heavy dependencies.
- **One-Command Setup**: `./slite init` handles everything — VENV, dependencies, and firewall.

---

## 🏗️ Architecture

```
Your App (Vercel / Browser / Any Client)
        ↓ HTTPS
SimpleLiteDB Service (Your VPS)
        ↓
SQLite Database Files (/data/*.db)
```

---

## 🛠️ Quick Start (VPS)

### 1. Clone & Initialize

```bash
git clone https://github.com/dnysaz/simple-lite-db.git
cd simple-lite-db
chmod +x slite
./slite init
```

This will automatically:
- Create a Python Virtual Environment (`.venv`)
- Install all dependencies (`fastapi`, `uvicorn`, etc.)
- Open port `5117` on your firewall (UFW)

### 2. Create Your First Database

```bash
./slite create db --api
```

You will be prompted to enter a database name. After creation, you'll receive:

```
✨ Project Ready!
--------------------------
slite_url      : http://145.79.12.100:5117
slite_db_name  : myproject
slite_api_key  : xxxxxxxxxxxxxxxxxxxxxxxxxxx
--------------------------
```

**Save these values** — you'll need them in your application.

### 3. Start the Service

```bash
./slite start db
```

### 4. Verify

```bash
./slite log
```

You should see:

```
INFO:     Uvicorn running on http://0.0.0.0:5117 (Press CTRL+C to quit)
```

---

## 📖 CLI Reference

### Database Management

| Command | Description |
| :--- | :--- |
| `./slite init` | Setup VENV, install deps, configure firewall |
| `./slite create db --api` | Create a new database and generate API key |
| `./slite list db` | Show all databases and their sizes |
| `./slite refresh [name]` | Reset/empty a database (keeps the file) |
| `./slite delete [name]` | Remove database file and its API key |
| `./slite download [name]` | Create a timestamped backup in `/downloads` |

### Service Control

| Command | Description |
| :--- | :--- |
| `./slite start db` | Run the service in background (Port: 5117) |
| `./slite stop db` | Stop the background service |
| `./slite log` | View live service logs (tail -f) |

### General

| Command | Description |
| :--- | :--- |
| `./slite help` | Show all available commands |

---

## 🔌 API Reference

### Endpoint

```
POST /query
```

### Headers

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### Request Body

```json
{
  "database": "myproject",
  "sql": "SELECT * FROM users WHERE id = ?",
  "params": [1]
}
```

### Success Response

```json
{
  "success": true,
  "rows": [
    { "id": 1, "name": "Ketut" }
  ]
}
```

### Error Response

```json
{
  "success": false,
  "error": "no such table: users"
}
```

### Health Check

```
GET /
```

Returns: `{ "status": "online", "message": "SimpleLiteDB is running" }`

---

## 🚀 Usage Examples

### Next.js (Server Component)

Create a helper file `lib/db.ts`:

```typescript
export async function query(sql: string, params: any[] = [], database = 'myproject') {
  const res = await fetch(process.env.SLITE_URL + '/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SLITE_API_KEY}`,
    },
    body: JSON.stringify({ database, sql, params }),
    cache: 'no-store',
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.rows;
}
```

Use it in your pages:

```tsx
import { query } from '@/lib/db';

export default async function UsersPage() {
  const users = await query('SELECT * FROM users ORDER BY id DESC');

  return (
    <ul>
      {users.map((u: any) => <li key={u.id}>{u.name}</li>)}
    </ul>
  );
}
```

Add to your `.env.local` in the Next.js project:

```env
SLITE_URL=http://YOUR_VPS_IP:5117
SLITE_API_KEY=your_api_key_here
```

### Vanilla JavaScript (Browser)

```javascript
async function query(sql, params = []) {
  const res = await fetch('http://YOUR_VPS_IP:5117/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY'
    },
    body: JSON.stringify({
      database: 'myproject',
      sql: sql,
      params: params
    })
  });
  return await res.json();
}

// Create table
await query('CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, message TEXT)');

// Insert data
await query('INSERT INTO logs (message) VALUES (?)', ['Hello from browser!']);

// Read data
const data = await query('SELECT * FROM logs ORDER BY id DESC LIMIT 10');
console.log(data.rows);
```

### cURL

```bash
curl -X POST http://YOUR_VPS_IP:5117/query \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"database":"myproject","sql":"SELECT * FROM users"}'
```

---

## 🔒 Security

### Per-Database API Keys

Each database has its own unique API key stored in `.env`:

```
KEY_MYPROJECT=abc123...
KEY_BLOG=def456...
KEY_SHOP=ghi789...
```

### Blocked SQL Commands

The following dangerous SQL commands are automatically blocked:

- `ATTACH`
- `DETACH`
- `VACUUM INTO`
- `PRAGMA writable_schema`

### Recommendations for Production

- Use **HTTPS** with Nginx + Certbot as a reverse proxy
- Enable **rate limiting** on your reverse proxy
- Keep your API keys in environment variables, never in client-side code
- Use **parameterized queries** (`?` placeholders) to prevent SQL injection

---

## 💾 Backup

SQLite makes backup extremely simple:

```bash
# Create a downloadable backup
./slite download myproject

# Or manually copy
cp data/myproject.db backup/myproject-$(date +%F).db
```

---

## 📂 Project Structure

```
simple-lite-db/
├── app.py              # FastAPI server with auth & CORS
├── database.py         # SQLite execution engine (WAL mode)
├── slite               # CLI management tool
├── requirements.txt    # Python dependencies
├── .env                # API keys (auto-generated, gitignored)
├── .venv/              # Virtual environment (auto-created)
├── data/               # Database files (gitignored)
│   ├── myproject.db
│   └── blog.db
├── downloads/          # Backup files (gitignored)
├── README.md
└── LICENSE
```

---

## ⚙️ Configuration

### Custom Port

Add `PORT=xxxx` to your `.env` file:

```
PORT=3000
```

Default port is `5117`.

### VPS Requirements

```
2 vCPU
2 GB RAM
40 GB SSD
Ubuntu 22/24
Python 3.10+
```

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

Built with ❤️ for developers who love simplicity.
