// Para testar, digite no terminal Bash: node backend/src/teste.js
import readline from 'readline';
import { carregarEPrepararQuiz } from './api.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function perguntar(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function iniciarJogoTerminal() {
  console.log('\n==================================================');
  console.log('       🎮 SIMULADOR DE QUIZ ENEM (TERMINAL)       ');
  console.log('==================================================\n');
  
  console.log('⏳ Carregando e balanceando questões...\n');
  const quiz = await carregarEPrepararQuiz(5); // Carrega 5 questões para o teste

  let pontuacao = 0;

  for (let i = 0; i < quiz.length; i++) {
    const q = quiz[i];
    
    console.log(`\n--------------------------------------------------`);
    console.log(`Questão ${i + 1}/${quiz.length} | Área: [${q.area}] - ${q.assunto}`);
    console.log(`--------------------------------------------------`);
    console.log(`\n${q.enunciado}\n`);

    q.alternativas.forEach(alt => {
      console.log(`  [${alt.letter}] ${alt.text}`);
    });

    const resposta = await perguntar('\nSua resposta (A, B, C, D ou E): ');
    
    if (resposta.trim().toUpperCase() === String(q.correta).toUpperCase()) {
      console.log('\n✅ RESPOSTA CORRETA!');
      pontuacao++;
    } else {
      console.log(`\n❌ RESPOSTA INCORRETA! A certa era a letra [${q.correta}]`);
    }
  }

  console.log('\n==================================================');
  console.log(`🏆 FIM DO TESTE! Você acertou ${pontuacao} de ${quiz.length} questões.`);
  console.log('==================================================\n');

  rl.close();
}

iniciarJogoTerminal();