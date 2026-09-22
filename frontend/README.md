# Frontend — Performance Quest: Rendimento por Assunto

Interface web interativa do **Performance Quest**, desenvolvida em arquitetura desacoplada para execução estática no navegador (Cloudflare Pages, Vercel, Netlify, GitHub Pages) consumindo a API REST do backend.

## Estrutura de Arquivos

```
frontend/
├── config.js                 # Ponto único de configuração (apiBaseUrl do backend)
├── css/
│   ├── style.css             # Estilos globais, variáveis e layout base
│   └── components.css        # Cards, botões, modais, ranking, sync states e responsividade
├── data/
│   └── questoes_fallback.json # Dataset de contingência local para funcionamento offline
├── js/
│   ├── api.js                # Cliente HTTP REST para /questions, /results, /rankings, /health
│   ├── quiz.js               # Sessão client-side autônoma, correção e algoritmo IPE (Top 3)
│   ├── storage.js            # Cadastro do aluno (nome, turma, matrícula) e fila offline
│   ├── ui.js                 # Renderização segura de DOM (anti-XSS), modais e estados
│   └── app.js                # Orquestração da aplicação, ciclo do quiz e atalhos de teclado
├── index.html                # Aplicação SPA (Single Page Application)
└── README.md                 # Documentação do módulo frontend
```

## Funcionalidades e Requisitos Atendidos

- **Configuração Centralizada (`config.js`):** A URL da API REST é definida unicamente em `window.PERFORMANCE_QUEST_CONFIG.apiBaseUrl`, facilitando publicação e deploy em diferentes ambientes sem alterar código-fonte.
- **Cadastro Simples do Estudante:** Armazenamento de nome, turma e matrícula via `storage.js`, com exibição no cabeçalho e modal de edição.
- **Desacoplamento Total:** O frontend é 100% estático e não importa arquivos locais de `backend/`, comunicando-se exclusivamente por HTTP.
- **Estados Visuais de Carregamento, Erro e Sincronização:**
  - Spinner/overlay durante carregamento de questões e consultas de ranking;
  - Banners de erro claros com ações de tentativa e modo de contingência local;
  - Indicador de sincronização pós-quiz com fila offline caso a API esteja temporariamente indisponível.
- **Ranking da Turma e Geral:** Modal responsivo com filtro por turma, classificação com critérios oficiais (maior percentual, maior número de acertos, menor tempo e data mais antiga) e destaque para o aluno ativo.
- **Segurança Anti-XSS:** Todas as inserções de dados externos (enunciados, alternativas, justificativas, nomes de alunos e turmas) são feitas via criação segura de elementos DOM (`textContent` e `replaceChildren`), eliminando o uso inseguro de `innerHTML`.
- **Acessibilidade & Responsividade:** Navegação por teclado (teclas A–E e Enter), layout testado para desktop e dispositivos móveis (375px+).

## Configuração e Execução

1. No arquivo `frontend/config.js`, configure a URL da sua API backend:
   ```js
   window.PERFORMANCE_QUEST_CONFIG = {
     apiBaseUrl: 'http://localhost:3001/api'
   };
   ```

2. Inicie o servidor local:
   ```bash
   npm start
   ```

3. Acesse no navegador:
   ```
   http://localhost:3000/frontend/
   ```

## Testes

Os testes automatizados do projeto podem ser executados com:
```bash
npm test
```

## Autor

**André Luiz Botelho de Souza**  
*Desenvolvedor Frontend*  
Atividades Práticas Interdisciplinares de Extensão II — UNINORTE (2026)