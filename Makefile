
.PHONY: install sync \
        fetch-price fetch-data update-price process-data \
        pipeline \
        backend frontend dashboard

# ── Environment ──────────────────────────────────────────────────────────────

install:
	uv sync

sync: install

# ── Pipeline ─────────────────────────────────────────────────────────────────

fetch-price:
	uv run pipeline --fetch-price

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
	cd packages/dashboard/backend && uv run uvicorn src.main:app --reload

frontend:
	cd packages/dashboard/frontend && npm run dev
