# SQLite HTTP Service Blueprint

## Overview

Tujuan project ini adalah membuat layanan SQLite online sederhana yang bisa dipakai oleh aplikasi serverless seperti Next.js di Vercel.

Konsep utama:

* SQLite tetap berjalan di VPS sendiri
* Aplikasi Next.js hanya mengakses via HTTP API
* Query tetap menggunakan syntax SQLite biasa
* Authentication hanya menggunakan API Key
* Fokus CRUD + Relasi
* Tidak mencoba menjadi distributed database
* Tidak ada edge replication
* Tidak ada cluster kompleks
* Fokus simplicity dan stability

---

# Architecture

```txt
Next.js App (Vercel)
        ↓ HTTPS
SQLite HTTP Service (VPS)
        ↓
SQLite Database Files
```

---

# Why This Exists

Vercel tidak cocok untuk SQLite lokal karena:

* filesystem ephemeral
* serverless environment
* instance bisa restart kapan saja
* SQLite file tidak persistent
* concurrency write bisa chaos

Maka solusi:

SQLite dipindahkan ke VPS.

Aplikasi Vercel hanya mengakses database via HTTP.

---

# Main Goals

* Simple
* Fast
* Lightweight
* SQLite syntax tetap normal
* Bisa dipakai dari Next.js
* Bisa dipakai dari backend lain
* Mudah backup
* Murah dioperasikan

---

# Recommended Stack

## Backend

* Python
* FastAPI
* Uvicorn
* sqlite3 bawaan Python

## Optional

* Redis (queue/cache)
* Docker
* Nginx

## Frontend/Client

* Next.js
* fetch API

---

# VPS Spec Recommendation

Untuk awal:

```txt
2 vCPU
2 GB RAM
40 GB SSD NVME
Ubuntu 24
```

Sudah cukup untuk banyak database SQLite kecil.

---

# Directory Structure

```txt
/project
    /data
        main.db
        app1.db
        app2.db

    app.py
    database.py
    auth.py
    requirements.txt
```

---

# Database Strategy

1 project = 1 SQLite file

Contoh:

```txt
/data/blog.db
/data/shop.db
/data/chat.db
```

Keuntungan:

* isolation mudah
* backup mudah
* migration mudah
* restore mudah
* corruption tidak menyebar

---

# SQLite Features Supported

Semua fitur SQLite normal tetap berjalan:

* SELECT
* INSERT
* UPDATE
* DELETE
* JOIN
* FOREIGN KEY
* INDEX
* TRIGGER
* TRANSACTION
* MIGRATION

---

# Required SQLite Settings

WAJIB aktifkan WAL mode.

```sql
PRAGMA journal_mode=WAL;
```

Kenapa:

* concurrency lebih baik
* read/write lebih stabil
* locking lebih minim

---

# API Design

## Endpoint

```http
POST /query
```

---

# Request Header

```txt
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

---

# Request Body

```json
{
  "database": "main",
  "sql": "SELECT * FROM users WHERE id = ?",
  "params": [1]
}
```

---

# Response

```json
{
  "success": true,
  "rows": [
    {
      "id": 1,
      "name": "Ketut"
    }
  ]
}
```

---

# Example Python Backend

## requirements.txt

```txt
fastapi
uvicorn
```

---

## database.py

```python
import sqlite3


def execute(database, sql, params=[]):

    db_path = f"data/{database}.db"

    conn = sqlite3.connect(db_path)

    conn.row_factory = sqlite3.Row

    conn.execute(
        "PRAGMA journal_mode=WAL;"
    )

    cur = conn.cursor()

    cur.execute(sql, params)

    rows = cur.fetchall()

    conn.commit()

    conn.close()

    return [dict(x) for x in rows]
```

---

## app.py

```python
from fastapi import FastAPI, Header
from pydantic import BaseModel

from database import execute

app = FastAPI()

API_KEY = "super-secret-key"


class Query(BaseModel):
    database: str
    sql: str
    params: list = []


@app.post("/query")
async def query(
    q: Query,
    authorization: str = Header(None)
):

    if authorization != f"Bearer {API_KEY}":
        return {
            "success": False,
            "error": "Unauthorized"
        }

    rows = execute(
        q.database,
        q.sql,
        q.params
    )

    return {
        "success": True,
        "rows": rows
    }
```

---

# Run Server

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

---

# Example Next.js Usage

```ts
const res = await fetch(
  "https://db.example.com/query",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer super-secret-key"
    },
    body: JSON.stringify({
      database: "main",
      sql: `
        SELECT *
        FROM users
        WHERE id = ?
      `,
      params: [1]
    })
  }
)

const data = await res.json()
```

---

# Recommended Security

Minimal:

* HTTPS only
* API Key authentication
* Query timeout
* Request size limit
* Rate limit

---

# Dangerous SQL To Block

Sebaiknya block:

```sql
ATTACH
DETACH
VACUUM INTO
PRAGMA writable_schema
```

Karena bisa dipakai untuk abuse.

---

# Recommended Limits

## Query Timeout

```txt
5 seconds
```

## Max Request Size

```txt
1 MB
```

## Max Rows

```txt
1000 rows
```

---

# Backup Strategy

Keuntungan SQLite:

Backup sangat mudah.

```bash
cp main.db backup/main-2026-05-07.db
```

---

# Recommended Backup Schedule

* hourly backup
* daily backup
* weekly backup

---

# Future Improvements

## Phase 1

* basic query endpoint
* API key
* WAL mode
* multi database

---

## Phase 2

* dashboard
* query history
* backup restore
* migration system

---

## Phase 3

* SDK package
* realtime updates
* websocket
* analytics
* usage tracking

---

# Optional SDK Idea

## Example Usage

```ts
const db = new SQLiteHTTP({
  url: "https://db.example.com",
  apiKey: "xxx"
})

const users = await db.query(`
  SELECT * FROM users
`)
```

---

# Why This Approach Is Good

Karena:

* tetap memakai SQLite asli
* syntax tetap normal
* ringan
* murah
* gampang deploy
* cocok untuk side project
* cocok untuk Vercel
* backup mudah
* relasi tetap full support

---

# Important Reality

Ini bukan distributed database.

Ini bukan replacement PostgreSQL cluster.

Ini adalah:

"SQLite over HTTP"

Dan itu sudah sangat powerful untuk banyak project kecil sampai menengah.

---

# Final Conclusion

Target project:

* Simple
* Reliable
* SQLite native syntax
* HTTP based
* Vercel friendly
* Self hosted
* CRUD + relation support

Fokus utama:

Developer experience.

Bukan distributed system complexity.
