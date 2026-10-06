# Backend - Performance Quest

API REST que serve as questões do ENEM e gerencia o ranking dos alunos.

## Estrutura
backend/
├── data/
│ ├── questoes_enem_2022_2023.json # Questões ENEM 2022 e 2023 com explicações
│ └── resultados.json # Ranking (persistência dos resultados)
├── src/
│ ├── api.js # Servidor Express (API REST)
│ ├── correcao.js # Lógica de correção das respostas
│ ├── diagnostico.js # Módulo de IA: cálculo do IPE
│ ├── relatorios.js # Geração de resumos e relatórios
│ ├── sessaoQuiz.js # Controle da sessão do quiz
│ └── storage.js # Gerenciamento de dados do aluno
└── README.md # Este arquivo
text


## Módulos

### `api.js`
Servidor Express que expõe os endpoints da API.

**Endpoints:**
- `GET /api/health` — Verifica se a API está no ar
- `GET /api/questions?area=Todas&quantity=10&year=all` — Busca questões de 2022 e 2023
- `POST /api/results` — Salva um resultado concluído
- `GET /api/rankings?className=4A&limit=20` — Consulta o ranking

### `diagnostico.js`
Responsável pelo cálculo do Índice de Prioridade de Estudo (IPE) e sugestão dos 3 assuntos prioritários.

**Funções exportadas:**
- `calcularDesempenhoPorAssunto(historico)`
- `calcularIPE(desempenho)`
- `sugerirAssuntosPrioritarios(historico, quantidade = 3)`

### `storage.js`
Gerencia a persistência de dados do aluno.

**Funções exportadas:**
- `salvarHistorico(novasRespostas)`
- `carregarHistorico()`
- `limparHistorico()`

### `relatorios.js`
Gera relatórios de desempenho a partir do histórico do aluno.

**Funções exportadas:**
- `gerarResumo()`
- `gerarRelatorioCompleto()`

### `correcao.js`
Responsável por corrigir as respostas do quiz.

### `sessaoQuiz.js`
Controla uma tentativa completa do quiz (registra respostas, calcula pontuação, finaliza).

## Como rodar

Na raiz do projeto:

```bash
npm run start:api

A API roda em http://localhost:3001.
Fonte de dados

As questões são armazenadas localmente em `data/questoes_enem_2022_2023.json`; para atualizar a cópia a partir de api.enem.dev, execute `npm run data:import-enem` na raiz do projeto. A API do quiz não precisa consultar a fonte externa em tempo de execução.

Autor

Carla Viana da Silva


