#!/usr/bin/env python3
"""
AlphaPulse IN — Terminal Runner
Starts FastAPI backend server on port 8000 and serves the 3D Quant Terminal.
"""
import sys
import webbrowser
import uvicorn
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

def main():
    print("=" * 70)
    print("  🚀 AlphaPulse IN — 3D Quant Trading Terminal & Scanner")
    print("  9 & 15 EMA + VWAP Strategy Engine | NSE F&O Universe")
    print("=" * 70)
    print("  ► 3D WebGL Terminal:   http://localhost:8000")
    print("  ► Original Dashboard:  http://localhost:8000/legacy")
    print("  ► Interactive Docs:    http://localhost:8000/docs")
    print("  ► WebSocket Stream:    ws://localhost:8000/api/ws/ticks")
    print("=" * 70)
    print("  Press Ctrl+C to stop the terminal server.\n")

    # Launch browser after a short delay
    try:
        webbrowser.open("http://localhost:8000")
    except Exception:
        pass

    # Start FastAPI server
    uvicorn.run(
        "backend.app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )

if __name__ == "__main__":
    main()
