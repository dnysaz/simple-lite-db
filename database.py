import sqlite3
import os

def execute(database, sql, params=[]):
    # Memastikan folder data ada
    if not os.path.exists("data"):
        os.makedirs("data")

    db_path = f"data/{database}.db"
    
    # Connect ke database
    conn = sqlite3.connect(db_path)
    
    # Agar hasil fetch berupa dictionary (key: value)
    conn.row_factory = sqlite3.Row
    
    # WAJIB: Aktifkan WAL mode untuk konkurensi
    conn.execute("PRAGMA journal_mode=WAL;")
    
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        
        # Ambil hasil jika ada
        rows = cur.fetchall()
        
        # Commit perubahan
        conn.commit()
        
        # Convert sqlite3.Row ke list of dict
        return [dict(x) for x in rows]
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
