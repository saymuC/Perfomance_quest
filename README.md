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

O cadastro do ranking usa um identificador aleatório persistido no navegador (localStorage), não impressão digital do dispositivo. A API impede nomes duplicados sem diferenciar maiúsculas, acentos ou espaços, e guarda apenas a melhor tentativa de cada aluno no ranking. Se os dados do navegador forem limpos ou o aluno trocar de dispositivo, use o mesmo nome e a mesma matrícula para recuperar o perfil existente.

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
| `GET` | `/api/questions?area=Todas&quantity=10&year=all` | Questões de 2022 e 2023; `year=2022` ou `year=2023` filtra um ano |
| `POST` | `/api/results` | Salva uma tentativa concluída |
| `GET` | `/api/rankings?className=3A&limit=20` | Ranking geral ou por turma |

O ranking usa: maior percentual, maior número de acertos, menor tempo e data mais antiga como critérios sucessivos.

## Operação e carga

`GET /api/health` informa persistência, uptime e uso instantâneo do pool PostgreSQL. O Render recebe esses logs JSON do processo, incluindo latência por rota, erros, espera pelos locks por identidade no cadastro e conexões em uso/espera; o dashboard do Supabase mostra o consumo do banco. Vercel Analytics mede o frontend e Core Web Vitals, não conexões PostgreSQL nem latência interna do Render.

Configure `PGPOOL_MAX` para que `PGPOOL_MAX * instâncias` fique abaixo do limite do plano PostgreSQL, reservando conexões para migrations e administração. O valor padrão é 5 por instância. O endpoint de cadastro e o envio de resultados têm limites locais por processo/IP (`RATE_LIMIT_STUDENTS`, `RATE_LIMIT_RESULTS`); com várias instâncias, use também rate limiting no proxy/WAF. No Render, configure `TRUST_PROXY_HOPS=1` para identificar IPs via proxy confiável. CORS não autentica chamadas: o app mantém fluxo público sem login, então abuso direcionado pode exigir autenticação ou CAPTCHA.

Para testar a API com PostgreSQL de teste (não use o banco de produção), configure `PG_LOAD_TEST_DATABASE_URL` no `.env` com uma URL separada da `DATABASE_URL` e execute `npm run test:postgres-load`. O script carrega o `.env`; sem essa variável, o Node informa claramente que o teste foi ignorado. O teste escala concorrência 1, 5, 10 e 25, mede p50/p95/máximo e erros, provoca cadastro concorrente de identidades iguais e verifica reenvios idempotentes e gravações no banco. Ajuste `PG_LOAD_TOTAL` e `PG_LOAD_CONCURRENCY` conforme o plano. O teste local `npm run test:stress` usa arquivo e não representa concorrência de PostgreSQL.

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
  apiBaseUrl: 'https://perfomance-quest-api.onrender.com/api'
};
```

Não coloque tokens nem senhas nesse arquivo: tudo no frontend é público.

## Testes

```bash
npm test
```

A suíte cobre lógica do quiz, validação, persistência entre reinícios, concorrência HTTP, ordenação/filtros do ranking, idempotência local e limites de entrada. `npm run test:stress` exercita centenas de gravações no armazenamento de arquivo local; somente `npm run test:postgres-load` valida concorrência e idempotência no PostgreSQL real.

## Trabalho da equipe

Consulte [TEAM_TASKS.md](./TEAM_TASKS.md) para responsáveis, arquivos, branches e ordem dos PRs.
