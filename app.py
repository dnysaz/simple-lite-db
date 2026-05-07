from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import List, Any, Optional
import os
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import execute

# Load environment variables dari .env jika ada
load_dotenv()

app = FastAPI(title="SimpleLiteDB HTTP Service")

# Aktifkan CORS agar bisa dipanggil dari Vanilla JS/Browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    database: str
    sql: str
    params: Optional[List[Any]] = []

# Daftar SQL yang dilarang untuk keamanan dasar
DANGEROUS_SQL = ["ATTACH", "DETACH", "VACUUM INTO", "PRAGMA writable_schema"]

@app.post("/query")
async def query(
    q: QueryRequest,
    authorization: str = Header(None)
):
    # 1. Validasi Auth per Database
    # Format key di .env: KEY_DBNAME (e.g. KEY_ONLINE_NOTE)
    db_upper = q.database.upper().replace("-", "_")
    env_key_name = f"KEY_{db_upper}"
    db_api_key = os.getenv(env_key_name)

    if not db_api_key:
        raise HTTPException(
            status_code=401, 
            detail=f"No API Key configured for database '{q.database}'"
        )

    if authorization != f"Bearer {db_api_key}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    # 2. Validasi Keamanan (Basic)
    sql_upper = q.sql.upper()
    for forbidden in DANGEROUS_SQL:
        if forbidden in sql_upper:
            raise HTTPException(
                status_code=400, 
                detail=f"Security Error: '{forbidden}' is not allowed."
            )

    try:
        # 3. Eksekusi Query
        rows = execute(
            q.database,
            q.sql,
            q.params if q.params else []
        )

        return {
            "success": True,
            "rows": rows
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/")
async def health_check():
    return {"status": "online", "message": "SimpleLiteDB is running"}
