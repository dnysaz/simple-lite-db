import json
import urllib.request

def test_query():
    url = "http://127.0.0.1:8000/query"
    api_key = "super-secret-key"
    
    payload = {
        "database": "main",
        "sql": "SELECT * FROM users WHERE id = ?",
        "params": [1]
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(payload).encode(), 
        headers=headers, 
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode()
            print("Response:")
            print(json.dumps(json.loads(res_body), indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Testing SimpleLiteDB API...")
    test_query()
