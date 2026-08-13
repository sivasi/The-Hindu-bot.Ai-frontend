# The Hindu Archive Q&A (Frontend)

Standalone Vite + React + Tailwind UI for the newspaper RAG Q&A API.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` if needed (defaults to the local API):

```
VITE_API_URL=http://localhost:3001
```

## Run

Start the backend on port 3001, then:

```bash
npm run dev
```

## Scope

Single Ask page: question → answer → expandable sources. No chat history, ingest, or corpus admin UI.
