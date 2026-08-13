# The Hindu Archive Q&A (Frontend)

Standalone Vite + React + Tailwind UI for the newspaper RAG Q&A API.

## Setup

```bash
npm install
```

## Run

Start the backend on port 3001, then:

```bash
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3001`. On Netlify, `netlify.toml` proxies `/api` to GKE.

## Scope

Single Ask page: question → answer → expandable sources. No chat history, ingest, or corpus admin UI.
