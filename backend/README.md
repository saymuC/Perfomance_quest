# Backend - Performance Quest

Este diretório contém os módulos de lógica do backend do Performance Quest.

## Estrutura

backend/
├── db/
│ ├── connection.js # Conexão com PostgreSQL
│ └── schema.sql # Tabelas students e quiz_attempts
├── src/
│ ├── attempts.js # Salvar tentativas (POST /api/results)
│ ├── diagnostico.js # Módulo de IA: cálculos de IPE
│ ├── relatorios.js # Geração de resumos e relatórios
│ ├── repository.js # Ranking (GET /api/rankings)
│ ├── sessaoQuiz.js # Lógica da sessão do quiz
│ └── storage.js # Gerenciamento do LocalStorage
├── test/
│ ├── correcao.test.js
│ ├── diagnostico.test.js
│ └── sessaoQuiz.test.js
├── README.md
└── PRIVACIDADE.md # Política de privacidade dos dados



## Módulos

### `db/connection.js`
Conexão com o PostgreSQL usando `pg` e `dotenv`.

### `db/schema.sql`
Cria as tabelas `students` e `quiz_attempts` no banco.

### `src/attempts.js`
Salva uma tentativa de quiz no banco.

**Funções exportadas:**
- `salvarTentativa(dados)`

### `src/repository.js`
Retorna o ranking, opcionalmente filtrado por turma.

**Funções exportadas:**
- `obterRanking(className, limit)`

### `src/diagnostico.js`
Responsável pelo cálculo do Índice de Prioridade de Estudo (IPE).

**Funções exportadas:**
- `calcularDesempenhoPorAssunto(historico)`
- `calcularIPE(desempenho)`
- `sugerirAssuntosPrioritarios(historico, quantidade = 3)`

### `src/relatorios.js`
Gera relatórios de desempenho a partir do histórico do aluno.

**Funções exportadas:**
- `gerarResumo()`
- `gerarRelatorioCompleto()`

### `src/storage.js`
Gerencia a persistência de dados no LocalStorage do navegador.

**Funções exportadas:**
- `salvarHistorico(novasRespostas)`
- `carregarHistorico()`
- `limparHistorico()`

## Como testar

1. Configure o `.env` com `DATABASE_URL`
2. Execute `psql -f db/schema.sql` para criar as tabelas
3. Rode `node teste-ranking.js` na raiz do projeto

## Autor

Carla Viana da Silva