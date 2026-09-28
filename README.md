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

Requisitos: Node.js 20 ou superior. Localmente, a API persiste resultados em `backend/data/results.jsonl` e os mantém após reiniciar. Esse modo usa um arquivo local e suporta apenas uma instância do backend; use PostgreSQL para produção ou múltiplas instâncias.

```bash
npm install
npm run start:backend
```

Em outro terminal, inicie o servidor estático:

```bash
npm run start:frontend
```

Acesse `http://localhost:3000/frontend/`. A API roda em `http://localhost:3001/api`; ambos os serviços precisam estar ativos.

Para usar o Supabase, copie `.env.example` para `.env`, preencha a URI PostgreSQL do projeto e aplique o schema com `npm run db:migrate`. O comando `npm run start:backend` carrega o `.env` automaticamente e o backend aplica migrations pendentes ao iniciar. No Supabase, use a URI em **Project Settings > Database > Connection string** e mantenha `DATABASE_SSL=true`. Nunca coloque essas credenciais no frontend ou no Git. Sem `DATABASE_URL`, o modo local continua usando `backend/data/results.jsonl`.

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

Publique como Web Service no Render, Railway, Fly.io ou outro provedor Node. Configure:

- `DATABASE_URL`: URI PostgreSQL do Supabase (preferencialmente Session Pooler para backend hospedado);
- `DATABASE_SSL=true`: conexão TLS do Supabase;
- `FRONTEND_ORIGIN=https://seu-frontend.com`: origens permitidas, separadas por vírgula;
- `PORT`: normalmente fornecida automaticamente pelo provedor.

O backend aplica migrations versionadas e cria tabela, restrições e índices ao iniciar. Use `npm run start:backend` como comando de início.

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

A suíte cobre lógica do quiz, validação, persistência entre reinícios, concorrência HTTP, ordenação/filtros do ranking e limites de entrada. `npm run test:stress` executa também o teste de carga com centenas de gravações concorrentes.

## Trabalho da equipe

Consulte [TEAM_TASKS.md](./TEAM_TASKS.md) para responsáveis, arquivos, branches e ordem dos PRs.
