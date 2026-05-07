from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
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

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/login")
async def login(req: LoginRequest):
    dash_user = os.getenv("DASHBOARD_USER")
    dash_pass = os.getenv("DASHBOARD_PASS")
    
    if req.username == dash_user and req.password == dash_pass:
        return {"success": True, "token": dash_pass} # Simple token for now
    return {"success": False, "detail": "Invalid IP (Username) or Password"}

# --- ADMIN ENDPOINTS (Requires Dashboard Token) ---

@app.get("/admin/databases")
async def admin_list_databases(authorization: Optional[str] = Header(None)):
    if authorization != f"Bearer {os.getenv('DASHBOARD_PASS')}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    databases = []
    if os.path.exists("data"):
        for file in os.listdir("data"):
            if file.endswith(".db"):
                name = file.replace(".db", "")
                # Cari API key di .env
                env_key = f"KEY_{name.upper().replace('-', '_')}"
                api_key = os.getenv(env_key, "No Key Found")
                databases.append({"name": name, "api_key": api_key})
    return {"success": True, "databases": databases}

class CreateDbRequest(BaseModel):
    name: str

@app.post("/admin/create_db")
async def admin_create_db(req: CreateDbRequest, authorization: Optional[str] = Header(None)):
    if authorization != f"Bearer {os.getenv('DASHBOARD_PASS')}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Logic creation (minimalist version of slite create db)
    import secrets
    import string
    
    db_name = req.name.strip().lower()
    if not db_name: return {"success": False, "error": "Invalid name"}
    
    db_path = f"data/{db_name}.db"
    if os.path.exists(db_path): return {"success": False, "error": "Database already exists"}
    
    # Generate API key
    api_key = "".join(secrets.choice(string.ascii_letters + string.digits + "_-") for _ in range(43))
    env_key = f"KEY_{db_name.upper().replace('-', '_')}"
    
    # Save to .env
    with open(".env", "a") as f:
        f.write(f"\n{env_key}={api_key}")
    
    # Create empty db
    import sqlite3
    sqlite3.connect(db_path).close()
    
    return {"success": True, "name": db_name, "api_key": api_key}

@app.get("/dashboard", response_class=HTMLResponse)
@app.get("/dashboard/", response_class=HTMLResponse)
async def get_dashboard():
    # Use absolute path to ensure the file is found
    base_path = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_path, "index.html")
    
    if not os.path.exists(file_path):
        return HTMLResponse(content=f"<h1>Error: index.html not found at {file_path}</h1>", status_code=404)
        
    with open(file_path, "r") as f:
        return f.read()

# Mount folder assets
app.mount("/html", StaticFiles(directory="html"), name="html")

@app.get("/", response_class=HTMLResponse)
async def get_root_dashboard():
    base_path = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_path, "index.html")
    if not os.path.exists(file_path):
        return HTMLResponse(content="<h1>index.html not found</h1>", status_code=404)
    with open(file_path, "r") as f:
        return f.read()
