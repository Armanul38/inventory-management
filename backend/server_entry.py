import os
import sys
import uvicorn

# Ensure backend package can be resolved properly when bundled
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Default to SQLite database if DATABASE_URL is not set for standalone desktop use
if "DATABASE_URL" not in os.environ:
    db_path = os.path.join(os.path.expanduser("~"), ".inventory_app", "inventory.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    print(f"[Desktop Backend] Using SQLite database at: {db_path}")

from backend.main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"[Desktop Backend] Starting Uvicorn server on {host}:{port}...")
    uvicorn.run(app, host=host, port=port, log_level="info")
