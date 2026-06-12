"""
Entry point for the packaged market-lens executable.

When frozen by PyInstaller:
  - sys.frozen is True
  - sys.executable is the path to the .exe / binary
  - sys._MEIPASS is the unpacked bundle directory (read-only)

All writable data (stock CSVs, logs, model artifacts) is stored in
market-lens-data/ next to the executable so the folder is portable and
the user can see / back up their data easily.
"""

import os
import sys
import threading
import time
import webbrowser
from pathlib import Path


def _exe_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    # Running as a plain script (e.g. python launcher.py for local testing)
    return Path(__file__).parent


def _setup_data_dir(base: Path) -> Path:
    data_dir = base / "market-lens-data"
    (data_dir / "data" / "archive_stock_data").mkdir(parents=True, exist_ok=True)
    (data_dir / "logs").mkdir(parents=True, exist_ok=True)
    (data_dir / "model-store").mkdir(parents=True, exist_ok=True)
    return data_dir


def main():
    exe_dir = _exe_dir()
    data_dir = _setup_data_dir(exe_dir)

    # Point backend config at the writable data folder.
    # setdefault so an explicit env var from the shell still wins.
    os.environ.setdefault("MARKET_LENS_DATA_DIR", str(data_dir))

    import uvicorn
    from market_lens_dashboard.main import app  # noqa: F401 — imported for side-effects (route registration)

    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="warning",
    )
    server = uvicorn.Server(config)

    def _open_browser():
        # Wait for the server to be ready before opening the browser.
        deadline = time.time() + 10
        while time.time() < deadline:
            time.sleep(0.2)
            if server.started:
                break
        webbrowser.open("http://127.0.0.1:8000")

    threading.Thread(target=_open_browser, daemon=True).start()
    server.run()


if __name__ == "__main__":
    main()
