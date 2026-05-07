# 🚀 SimpleLiteDB

**SimpleLiteDB** is a minimalist, high-performance "SQLite over HTTP" service designed specifically for serverless environments like **Vercel** or **Netlify**. It allows you to use a persistent SQLite database hosted on your own VPS via a simple HTTP API.

---

## ✨ Features

- **Standard SQL**: Use standard SQLite syntax you already know.
- **Vercel Friendly**: Access your database from serverless functions via `fetch`.
- **Multi-Project**: Manage multiple isolated databases with unique API keys.
- **WAL Mode**: Built-in Write-Ahead Logging for better concurrency.
- **Secure**: Basic protection against dangerous SQL commands.
- **One-Click Setup**: Automated dependencies installation and firewall configuration.

---

## 🛠️ Quick Start (VPS)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dnysaz/simple-lite-db.git
   cd simple-lite-db
   ```

2. **Initialize the service:**
   ```bash
   chmod +x slite
   ./slite init
   ```

3. **Create your first database:**
   ```bash
   ./slite create db --api
   ```

4. **Start the service:**
   ```bash
   ./slite start db
   ```

---

## 📖 CLI Usage

| Command | Description |
| :--- | :--- |
| `./slite init` | Setup dependencies, folders, and firewall |
| `./slite create db --api` | Create a new database and get API key |
| `./slite list db` | Show all databases and their sizes |
| `./slite start db` | Run the service in background (Port: 5117) |
| `./slite stop db` | Stop the background service |
| `./slite log` | View live service logs |
| `./slite refresh [name]` | Reset/empty a database |
| `./slite delete [name]` | Remove database and its API key |
| `./slite download [name]`| Create a downloadable backup |

---

## 🚀 Usage in Next.js

```typescript
async function query(sql, params = [], database = 'main') {
  const res = await fetch('http://your-vps-ip:5117/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY',
    },
    body: JSON.stringify({ database, sql, params }),
  });
  return await res.json();
}

// Example Query
const users = await query('SELECT * FROM users WHERE id = ?', [1]);
```

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

Built with ❤️ for the Developer Community.
