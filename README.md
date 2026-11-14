# ColdGuard: RAG chatbot for Qi Groceries (AIML-501 Group 4)

ColdGuard answers questions about refrigeration, food safety, equipment set points, preventive
maintenance and our project, using retrieval-augmented generation (RAG) with cited sources,
guardrails and a human handoff.

Team: Dhanush Papani, Congshan Yang, Qi Wang, Farukh Ahemad Gesukhan Pathan, Jayanth Kumar Dadi.

## How it works
- `public/index.html`: the chatbot (knowledge base, BM25 retrieval, guardrails, UI).
- `server.js`: serves the page and forwards AI calls to the Anthropic API. The API key stays
  on the server; it is never sent to the browser. Includes a simple per-visitor rate limit.
- No API key set? The site still works in passages-only mode (no AI-written answers).

## Deploy on Render (free)
1. Put these files in a GitHub repository (keep the folder layout: `server.js`,
   `package.json`, `render.yaml`, `public/index.html`).
2. In Render: **New → Blueprint**, connect the repository, and click **Apply**.
3. When asked for `ANTHROPIC_API_KEY`, paste a key from console.anthropic.com.
4. Wait for the deploy to finish. Your link is shown at the top, e.g.
   `https://coldguard.onrender.com` (Render may add a suffix if the name is taken).

## Run locally
```
ANTHROPIC_API_KEY=your_key node server.js
```
Then open http://localhost:10000.

## Settings (environment variables)
| Name | Default | Meaning |
|---|---|---|
| ANTHROPIC_API_KEY | (none) | Required for AI answers |
| ANTHROPIC_MODEL | claude-sonnet-5-5 | Model that writes answers |
| ANTHROPIC_QUICK_MODEL | claude-haiku-5-5 | Model that re-ranks passages |
| RATE_LIMIT_PER_10_MIN | 40 | Questions per visitor per 10 minutes |
