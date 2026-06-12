
.PHONY: install sync \
        fetch-price fetch-data update-price process-data \
        pipeline \
        backend frontend dashboard \
        release

# ── Environment ──────────────────────────────────────────────────────────────

install:
	uv sync

sync: install

# ── Pipeline ─────────────────────────────────────────────────────────────────

fetch-price:
	uv run pipeline --fetch-price

force-fetch-price:
	uv run pipeline --fetch-price-force

fetch-data:
	uv run pipeline --fetch-data

update-price:
	uv run pipeline --update-price

process-data:
	uv run pipeline --process-data

pipeline:
	uv run pipeline

# ── Dashboard ─────────────────────────────────────────────────────────────────

backend:
	cd packages/dashboard/backend/src && uv run uvicorn market_lens_dashboard.main:app --reload

frontend:
	cd packages/dashboard/frontend && npm run dev

# ── Release ───────────────────────────────────────────────────────────────────

release:
	cd packages/dashboard/frontend && npm run build
	uv pip install --quiet pyinstaller
	uv run pyinstaller market-lens.spec --noconfirm
