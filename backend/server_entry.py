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

# Default to PostgreSQL database if DATABASE_URL is not set
if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@127.0.0.1:5434/inventory"
    print("[Desktop Backend] Using PostgreSQL database at: 127.0.0.1:5434")

from backend.main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"[Desktop Backend] Starting Uvicorn server on {host}:{port}...")
    uvicorn.run(app, host=host, port=port, log_level="info")
