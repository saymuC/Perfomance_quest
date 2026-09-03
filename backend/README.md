# Backend - Performance Quest

Este diretório contém os módulos de lógica do backend do Performance Quest.

## Estrutura

```
backend/
├── src/
│   ├── diagnostico.js    # Módulo de IA: cálculos de IPE e sugestão de assuntos
│   ├── storage.js        # Gerenciamento do LocalStorage
│   └── relatorios.js     # Geração de resumos e relatórios
└── README.md             # Este arquivo
```

## Módulos

### `diagnostico.js`
Responsável pelo cálculo do Índice de Prioridade de Estudo (IPE) e sugestão dos 3 assuntos prioritários.

**Funções exportadas:**
- `calcularDesempenhoPorAssunto(historico)`
- `calcularIPE(desempenho)`
- `sugerirAssuntosPrioritarios(historico, quantidade = 3)`

### `storage.js`
Gerencia a persistência de dados no LocalStorage do navegador.

**Funções exportadas:**
- `salvarHistorico(novasRespostas)`
- `carregarHistorico()`
- `limparHistorico()`

### `relatorios.js`
Gera relatórios de desempenho a partir do histórico do aluno.

**Funções exportadas:**
- `gerarResumo()`
- `gerarRelatorioCompleto()`

## Como testar

Para testar o funcionamento dos módulos, abra o arquivo `teste_backend.html` que está na raiz do projeto.

## Autor

Carla Viana da Silva