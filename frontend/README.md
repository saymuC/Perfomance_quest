# Frontend — Performance Quest: Rendimento por Assunto

Este diretório contém a interface web interativa do **Performance Quest**, desenvolvida para proporcionar aos estudantes uma experiência fluida, responsiva e acessível na resolução de simulados do ENEM com diagnóstico por IA.

## Estrutura

```
frontend/
├── css/
│   ├── style.css                 # Estilos globais, variáveis de design e layout base
│   └── components.css            # Estilização de cards, botões, opções, timer e gabarito
├── data/
│   └── questoes_fallback.json    # Dataset de contingência local para funcionamento offline
├── js/
│   ├── api.js                    # Consumo da api.enem.dev e classificador de tópicos
│   ├── ui.js                     # Gerenciamento de elementos DOM, telas e revisões
│   └── app.js                    # Ciclo de vida do quiz e orquestração do backend
├── index.html                    # Ponto de entrada visual da aplicação
└── README.md                     # Este arquivo
```

## Funcionalidades e Diferenciais

- **Tecnologias Limpas (Vanilla JS/CSS3/HTML5):** Desenvolvido sem frameworks pesados para garantir máximo desempenho em computadores escolares e dispositivos móveis (RNF01, RNF02).
- **Consumo Dinâmico & Resiliência:** Integração com a API pública do ENEM (`api.enem.dev`) e fallback automático para arquivo JSON local caso não haja conexão com a internet (RF01, RF02).
- **Classificação Pedagógica por IA:** Mapeamento heurístico de assuntos para cada questão consumida da API (RF04).
- **Acessibilidade por Teclado:** Suporte completo para resolução do quiz utilizando as teclas **A, B, C, D, E** e confirmação/avanço via tecla **Enter** (RNF05).
- **Feedback Imediato:** Identificação instantânea de acertos/erros com exibição do gabarito oficial e justificativa pedagógica (RF06).
- **Painel Diagnóstico (Pós-Quiz):** 
  - Cálculo do Índice de Prioridade de Estudo (IPE) com destaque para os **3 assuntos prioritários de estudo** (RF09).
  - Indicadores visuais de aproveitamento por área de conhecimento (RF08, RF10).
  - Revisão detalhada questão por questão do simulado realizado.
- **Persistência Local (LocalStorage):** Histórico de simulados e métricas cumulativas salvas no próprio navegador, sem necessidade de cadastro ou servidores remotos de banco de dados (RF07, RNF04).

## Como Executar

1. Na raiz do projeto, execute o servidor local:
   ```bash
   npm start
   ```
2. Abra o navegador no endereço indicado:
   ```
   http://localhost:3000
   ```

## Autor

**André Luiz Botelho de Souza**  
*Desenvolvedor Frontend*  
Atividades Práticas Interdisciplinares de Extensão II — UNINORTE (2026)