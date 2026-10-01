PYTHON ?= python3.11
VENV    := backend/.venv
PY      := $(VENV)/bin/python

.PHONY: setup setup-backend setup-frontend env backend frontend dev test test-backend test-frontend

setup: setup-backend setup-frontend env

setup-backend:
	test -d $(VENV) || $(PYTHON) -m venv $(VENV)
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -r backend/requirements/dev.txt -r backend/requirements/eeg.txt -r backend/requirements/mri.txt

setup-frontend:
	cd frontend && npm ci

env:
	test -f backend/.env || cp backend/.env.example backend/.env
	test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

dev:
	$(MAKE) -j2 backend frontend

test: test-backend test-frontend

test-backend:
	cd backend && .venv/bin/pytest -q

test-frontend:
	cd frontend && npx tsc --noEmit && npm run lint
