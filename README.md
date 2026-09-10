# Resume AI — Update

This replaces your `backend/` and `frontend/` folders. Your existing
`resume_tailor.db` and `.env` are **not included** here (this zip never saw
your real secrets) — keep using the ones you already have.

## What's new

- **Claude support** — `ai_service.py` now calls Anthropic directly
  (`ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` in `.env`), alongside OpenAI and
  the existing Ollama fallback. The model toggle in the UI now shows
  Claude / OpenAI, matching your screenshots.
- **Resume picker + experience-level pill** — top-right dropdown to switch
  between saved resumes, plus an editable "Mid Level (3-5 yrs)" pill.
- **Formatting panel** — drag-to-reorder section order, a 6-template grid
  (Original / Classic / Modern / Oslo / Emerald / Chicago), font family,
  font-size slider, and page size — all persisted via `/settings` and
  applied to both the live preview and PDF/DOCX export.
- **Richer AI output** — the prompt now asks for ALL-CAPS section headers
  and `**bold**` key terms; the frontend renders that as a real formatted
  resume (not a plain text block), and the PDF/DOCX export now word-wraps
  properly and renders bold spans and template accent colors too.
- **Admin Dashboard** — new nav item (only visible to admins) showing
  system-wide usage across every account. The **first user who registers**
  is made admin automatically.
- **New DB columns** — `resumes.experience_level`, `user_settings.template`,
  `users.is_admin`. A small migration in `database.py` (`run_migrations()`)
  adds these to your existing SQLite file automatically on startup — no
  manual migration needed.

## Setup

```bash
# Backend
cd backend
cp .env.example .env         # then fill in your real keys
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Put your existing `resume_tailor.db` back into `backend/` before starting
the server (or leave it out to start fresh) — the migration runs
automatically either way.

For production (e.g. your Elastic Beanstalk deployment), set `CORS_ORIGINS`
in `backend/.env` to your deployed frontend URL, and set
`VITE_API_BASE_URL` when building the frontend to point at your deployed
API instead of `localhost:8000`.

## Notes / things you may want to adjust

- `ANTHROPIC_MODEL` defaults to `claude-sonnet-4-5` — check
  https://docs.claude.com for the current model name if this changes.
- Daily generate/export limits live in `backend/app/rate_limits.py`
  (`DAILY_LIMITS`) — change the numbers there if 20 generations/day is
  too low or high.
- The 6 templates currently differ by accent color (preview + PDF/DOCX
  headings) and a couple of layout tweaks for Chicago/Classic. If you want
  deeper per-template layout differences (columns, different fonts per
  template, etc.), that's a good next iteration in `export_service.py`
  and `index.css`.
