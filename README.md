# Performance Quest

Simulador ENEM multiusuário com diagnóstico individual e ranking por turma. O projeto agora possui duas aplicações independentes:

- `frontend/`: site estático executado no navegador;
- `backend/`: API REST Node.js que consulta questões, grava tentativas e monta rankings;
- PostgreSQL: persistência central compartilhada entre todos os alunos.

## Arquitetura

```text
Navegador / frontend estático
          |
          | HTTPS / JSON
          v
Backend Node.js / API REST ------> PostgreSQL
          |
          +----------------------> api.enem.dev
          |
          +----------------------> fallback local de questões
```

O frontend não importa mais arquivos de `backend/`. A comunicação entre os dois ocorre exclusivamente por HTTP.

## Executar localmente

Requisitos: Node.js 20 ou superior. PostgreSQL é opcional no desenvolvimento; sem `DATABASE_URL`, a API usa memória e perde os rankings ao reiniciar.

```bash
npm install
cp backend/.env.example backend/.env
npm run start:backend
```

Em outro terminal:

```bash
npm run start:frontend
```

Acesse `http://localhost:3000/frontend/`. A API roda em `http://localhost:3001/api`.

## Banco de dados

Crie um banco PostgreSQL, configure `DATABASE_URL` em `backend/.env` e execute:

```bash
npm --workspace backend run db:migrate
```

## API

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/api/health` | Saúde e tipo de persistência |
| `GET` | `/api/questions?area=Todas&quantity=10&year=2023` | Questões normalizadas e balanceadas |
| `POST` | `/api/results` | Salva uma tentativa concluída |
| `GET` | `/api/rankings?className=3A&limit=20` | Ranking geral ou por turma |

O ranking usa: maior percentual, maior número de acertos, menor tempo e data mais antiga como critérios sucessivos.

## Publicar separadamente

### Backend

Publique como Web Service no Render, Railway, Fly.io ou outro provedor Node/Docker. Configure:

- `DATABASE_URL`: conexão do PostgreSQL;
- `DATABASE_SSL=true`: quando o provedor exigir TLS;
- `FRONTEND_ORIGIN=https://seu-frontend.com`: origens permitidas, separadas por vírgula;
- `PORT`: normalmente fornecida automaticamente pelo provedor.

Execute a migração uma vez e use `npm --workspace backend start` quando o deploy partir da raiz do monorepo. O `backend/Dockerfile` também permite publicar somente a API.

### Frontend

Publique a pasta `frontend/` no Cloudflare Pages, Vercel, Netlify ou GitHub Pages. Antes, altere `frontend/config.js`:

```js
window.PERFORMANCE_QUEST_CONFIG = {
  apiBaseUrl: 'https://sua-api.com/api'
};
```

Não coloque tokens nem senhas nesse arquivo: tudo no frontend é público.

## Testes

```bash
npm test
```

A suíte cobre o núcleo do quiz, validação/correção, seleção de questões, API de resultados e ranking em memória.

## Trabalho da equipe

Consulte [TEAM_TASKS.md](./TEAM_TASKS.md) para responsáveis, arquivos, branches e ordem dos PRs.
