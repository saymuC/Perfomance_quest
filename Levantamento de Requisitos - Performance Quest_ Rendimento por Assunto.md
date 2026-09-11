# **Documento de Levantamento de Requisitos — Performance Quest: Rendimento por Assunto**

**Projeto:** Performance Quest: Rendimento por Assunto  
**Curso:** Análise e Desenvolvimento de Sistemas (Atividades Práticas Interdisciplinares de Extensão II)  
**Instituição:** Centro Universitário do Norte (UNINORTE) — Manaus-AM  
**Ano:** 2026  
**Autores/Equipe do Projeto:** Carla Viana da Silva, Ana Claudia Freitas da Silva, André Luiz Botelho de Souza, Duilio Gabriel Cardoso da Cunha, Saymon Henrique Cruz Alencar, Samantha Santos da Costa.

## ---

## **1\. Visão Geral do Sistema e Objetivos**

O **Performance Quest: Rendimento por Assunto** é uma plataforma web interativa desenvolvida com o propósito de apoiar estudantes (prioritariamente do Ensino Médio de escolas públicas de Manaus-AM) na preparação para o Exame Nacional do Ensino Médio (ENEM). A solução combina autonomia, acesso simplificado e aprendizado orientado por dados para fornecer diagnósticos precisos sobre o desempenho do aluno.  
O sistema realiza a aplicação de simulados e quizzes interativos, avaliando o desempenho por área de conhecimento e tópicos específicos, culminando em relatórios estatísticos detalhados e recomendações personalizadas de estudo.

## 

## **2\. Diferenciais do Sistema**

> * **Integração com a API Pública do ENEM (api.enem.dev):** Utilização de uma base oficial de perguntas reais aplicadas em edições anteriores do ENEM, garantindo fidelidade ao estilo do exame, legitimidade pedagógica e alinhamento com as competências cobradas.  
> * **Módulo de Inteligência Artificial Próprio:** Algoritmo de IA desenvolvido pela equipe do projeto responsável por:  
  * *Seleção Inteligente de Questões:* Filtragem e montagem dinâmica de simulados baseados na distribuição de áreas e níveis de relevância a partir dos dados consumidos da API.  
  * *Diagnóstico e Estatísticas Finais:* Processamento do histórico de acertos/erros para gerar um relatório analítico ao final do quiz, destacando categoricamente os **3 assuntos em que o aluno possui menor desempenho e deve focar seus estudos prioritariamente**.  
> * **Arquitetura Leve e Acessível:** Funcionamento 100% via navegador, sem necessidade de cadastro complexo ou servidor centralizado pesado, permitindo execução fluida em redes escolares públicas e dispositivos diversos.

## 

## **3\. Perfis e Atores de Usuários**

| Perfil | Descrição e Acessos   |
| :---- | :---- |
| **Aluno / Usuário** | Acessa o quiz sem necessidade de login prévio, responde às questões do simulado, recebe feedback imediato e visualiza o relatório final gerado pela IA com os 3 assuntos prioritários de estudo. |
| **Professor / Educador (Acompanhante)** | Utiliza a ferramenta em ambiente de sala de aula/laboratório como recurso pedagógico complementar para diagnosticar pontos fracos das turmas. |

## 

## **4\. Requisitos Funcionais (RF)**

### **4.1 Integração com API Externa e Banco de Dados**

> * **RF01 — Consumo da API Pública do ENEM:** O sistema deve integrar-se à API pública (api.enem.dev) para obter dinamicamente questões oficiais do ENEM, incluindo enunciados, alternativas, áreas do conhecimento e gabarito oficial.  
> * **RF02 — Contingência e Fallback Local:** O sistema deve possuir um arquivo JSON local atualizado contendo questões estruturadas para garantir o funcionamento ininterrupto da aplicação caso a API externa fique indisponível ou haja perda de conexão com a internet.

### **4.2 Módulo de Inteligência Artificial e Seleção de Perguntas**

> * **RF03 — Seleção Inteligente de Questões via IA:** O algoritmo de IA desenvolvido pela equipe deve selecionar automaticamente as questões trazidas da API, garantindo variedade de matérias, equilíbrio entre áreas do conhecimento e adequação ao escopo do quiz.  
> * **RF04 — Mapeamento por Assunto/Tópico:** A IA deve categorizar e associar cada pergunta a um assunto/tópico específico (ex: "Ecologia", "Equações do 2º Grau", "Interpretação de Texto", "Termoquímica").

### **4.3 Execução do Quiz e Interação**

> * **RF05 — Interface do Quiz:** O sistema deve exibir a pergunta, imagens de apoio (se houver), alternativas marcáveis e um cronômetro ou indicador de progresso.  
> * **RF06 — Correção Automática com Feedback Imediato:** Ao submeter uma resposta, o sistema deve registrar a escolha, indicar imediatamente se a resposta está correta ou incorreta e exibir a alternativa certa com uma justificativa/gabarito.  
> * **RF07 — Registro de Histórico em LocalStorage:** O sistema deve armazenar o progresso do usuário e o histórico de tentativas localmente no navegador via LocalStorage, eliminando a dependência de bancos de dados em servidores remotos.

### **4.4 Relatórios e Análise Estatística (Pós-Quiz)**

> * **RF08 — Geração de Relatório de Rendimento:** Ao finalizar o quiz, o sistema deve calcular a porcentagem geral de acertos por área de conhecimento (Linguagens, Matemática, Ciências Humanas, Ciências da Natureza).  
> * **RF09 — Diagnóstico IA das 3 Áreas/Assuntos Prioritários:** A IA da equipe deve analisar o cruzamento de erros, tempo de resposta e peso dos assuntos para apresentar explicitamente ao usuário os **3 assuntos prioritários em que ele obteve menor rendimento e precisa focar seus estudos**.  
> * **RF10 — Visualização Gráfica de Desempenho:** O relatório final deve exibir gráficos/indicadores visuais amigáveis que mostrem a taxa de acerto por tópico.

## 

## **5\. Requisitos Não Funcionais (RNF)**

| Código | Categoria | Descrição do Requisito   |
| :---- | :---- | :---- |
| **RNF01** | Usabilidade / Responsividade | A interface gráfica deve ser leve e responsiva, adaptando-se perfeitamente a dispositivos móveis (smartphones) e desktops. |
| **RNF02** | Tecnologias Utilizadas | Desenvolvimento Front-end limpo utilizando HTML5, CSS3 e JavaScript puro (Vanilla JS), sem frameworks pesados, visando máxima leveza. |
| **RNF03** | Performance e Desempenho | O tempo de carregamento da aplicação e de resposta entre as perguntas deve ser inferior a 2 segundos em conexões padrão de internet. |
| **RNF04** | Privacidade e LGPD | Não deve haver coleta obrigatoriedade de dados pessoais sensíveis (como CPF ou e-mail), mantendo a privacidade total do aluno sob uso local. |
| **RNF05** | Acessibilidade e Compatibilidade | Compatível com os principais navegadores modernos (Google Chrome, Mozilla Firefox, Microsoft Edge e Safari). |

## 

## **6\. Regras de Negócio (RN)**

> * **RN01 — Identificação do Top 3 Assuntos de Estudo:** Para calcular os 3 assuntos prioritários, o algoritmo deve contabilizar o menor percentual absoluto de acertos em assuntos com no mínimo 2 perguntas respondidas. Caso haja empate, o assunto com maior tempo médio gasto por questão será priorizado para recomendação de estudo.  
> * **RN02 — Autonomia por Sessão:** Como a aplicação armazena os dados via LocalStorage, a exclusão do cache ou dados de navegação do usuário resultará no reinício das estatísticas registradas.  
> * **RN03 — Validação de Resposta Única:** O estudante só poderá selecionar e submeter uma única alternativa por questão, não sendo permitida a alteração após o feedback imediato do gabarito.

## 

## **7\. Módulo de Inteligência Artificial e Análise Estatística (Detalhamento)**

O módulo de Inteligência Artificial implementado pela equipe atua como um motor estatístico e preditivo no lado do cliente (Client-Side AI). Suas funções técnicas englobam:

### **7.1 Algoritmo de Seleção e Curadoria via API**

> 1. Recepção do payload de perguntas provenientes da api.enem.dev.  
> 2. Higienização dos dados e verificação de integridade (presença de enunciado, alternativas e gabarito).  
> 3. Mapeamento dinâmico de rótulos pedagógicos por assunto.

### **7.2 Motor de Diagnóstico Pedagógico (Os 3 Assuntos Foco)**

O cálculo de rendimento ponderado para determinação dos assuntos prioritários obedece à seguinte lógica matemática/estatística:  
Índice de Prioridade de Estudo (IPE) \= (1 \- (Acertos\_do\_Assunto / Total\_de\_Questoes\_do\_Assunto)) \* Peso\_Tempo

> * Ao final da sessão, a IA classifica todos os assuntos em ordem decrescente do Índice de Prioridade de Estudo (IPE).  
> * Os **3 maiores IPEs** são extraídos e apresentados em destaque no painel de relatórios do usuário com mensagens personalizadas de incentivo e orientação pedagógica.

## 

## **8\. Considerações de Arquitetura e Segurança**

> * **Sem Necessidade de Servidor Backend Central:** Toda a lógica de estado do quiz, cálculo estatístico, IA de diagnóstico e persistência de dados ocorre no navegador do cliente (JS \+ LocalStorage).  
> * **Resiliência de Rede:** O mecanismo de contingência com arquivo JSON interno assegura o pleno funcionamento da aplicação mesmo em cenários de instabilidade na infraestrutura da escola pública.