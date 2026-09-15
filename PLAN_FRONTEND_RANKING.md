# Plan: `feat/frontend-ranking`

## Context

The project architecture has changed significantly since our last PR. Key shifts from the updated README.md:

- **Frontend no longer imports from `backend/`**. All communication is now via HTTP to a REST API at `/api/`.
- **Backend is now an API server** on port 3001 with endpoints for `/api/questions`, `/api/results`, `/api/rankings`, `/api/health`.
- **PostgreSQL** replaces `localStorage` for persistence (rankings, results).
- **`frontend/config.js`** is the single source for the API base URL.
- The `api-enem` branch has teammate changes to `frontend/js/api.js` (Fisher-Yates shuffle, deduplication, balancing) that conflict with ours — we need to incorporate their improvements.

## Tasks from the Tech Lead

> Our scope is **`frontend/**` only**. No backend changes.

---

### Task 1: Create `frontend/config.js`
**Why:** The README specifies this as the single config point for the API URL. Currently doesn't exist anywhere.

- Create `frontend/config.js` setting `window.PERFORMANCE_QUEST_CONFIG.apiBaseUrl` to `http://localhost:3001/api` (dev default).
- Load it via `<script>` in `index.html` **before** `app.js`.
- Refactor `frontend/js/api.js` to read from `window.PERFORMANCE_QUEST_CONFIG.apiBaseUrl` instead of hardcoded `https://api.enem.dev/v1`.

### Task 2: Refactor `api.js` — Consume Only the Backend API
**Why:** Frontend must no longer call `api.enem.dev` directly. It calls our backend API which handles that.

- Replace `obterQuestoesSimulado()` to call `GET /api/questions?area=X&quantity=N&year=Y`.
- Add `enviarResultado(payload)` to call `POST /api/results`.
- Add `obterRanking(className, limit)` to call `GET /api/rankings`.
- Add `verificarSaude()` to call `GET /api/health`.
- Keep the Fisher-Yates, dedup, and balancing logic from `api-enem` branch since the backend may not do all of that.
- Remove direct `api.enem.dev` calls and the local fallback fetch (backend handles fallback now).

### Task 3: Simple Student Registration (Name, Class, Student ID)
**Why:** Tech lead requires "cadastro simples de nome, turma e matrícula" for ranking identification.

- Add a registration form screen shown on first visit (before the quiz config screen).
- Fields: `nome` (name), `turma` (class, e.g. "3A"), `matricula` (student ID).
- Save to `localStorage` so the student doesn't re-register every visit.
- Show current student info in the header with an "edit" option.
- Include student data in the `POST /api/results` payload.

### Task 4: Loading, Error, and Sync States
**Why:** "finalizar estados de carregamento, erro e sincronização" — the current UI has no visual feedback for async operations.

- Add a loading spinner/overlay for: quiz start (fetching questions), answer submission, result submission, ranking fetch.
- Add error banners with retry buttons for: API connection failure, question loading failure, result submission failure.
- Add sync indicator showing whether the result was successfully saved to the server or is pending.

### Task 5: Ranking Modal/Screen + Responsiveness
**Why:** "evoluir modal/tela do ranking e responsividade" — ranking display doesn't exist yet.

- Create a ranking modal/section accessible from the results screen and home screen.
- Display: position, student name, class, score %, number correct, total time.
- Filter by class (`turma`) with a dropdown.
- Ensure full mobile responsiveness (test at 375px viewport).

### Task 6: Remove Unsafe `innerHTML` Usage
**Why:** "remover usos inseguros de innerHTML com conteúdo externo" — XSS risk from API content injected via innerHTML.

- Audit all `innerHTML` assignments in `ui.js` and `app.js`.
- Replace with safe DOM creation (`createElement`, `textContent`) for any content originating from the API or user input.
- Keep `innerHTML` only for static templates with no external data interpolation.

---

## Commit Strategy (Incremental, Human-Paced)

| # | Commit | Files |
|---|--------|-------|
| 1 | `feat: cria config.js e refatora api.js para consumir backend` | `config.js`, `api.js`, `index.html` |
| 2 | `feat: tela de cadastro simples do aluno` | `index.html`, `app.js`, `ui.js`, `components.css` |
| 3 | `feat: estados de carregamento e tratamento de erros` | `ui.js`, `app.js`, `components.css` |
| 4 | `feat: modal de ranking com filtro por turma` | `index.html`, `ui.js`, `app.js`, `components.css` |
| 5 | `fix: substitui innerHTML inseguro por criacao segura de DOM` | `ui.js`, `app.js` |
| 6 | `style: ajustes de responsividade mobile` | `style.css`, `components.css` |
