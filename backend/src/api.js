// api.js - Servidor de API do Performance Quest 
// Lê o JSON de questões e serve para o frontend


import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

// Permite que o frontend acesse a API

app.use(cors());
app.use(express.json());


// Rota: Health check 

app.get('/api/health', (req, res) => {

    res.json({ ok: true, service: 'Performance Quest API' });
});

// ROTA: Questões

app.get('/api/questions', (req, res) => {
    try {
        const caminhoJson = path.join(__dirname, '..', 'data', 'questoes_enem_2023_2024.json');
        const conteudo = fs.readFileSync(caminhoJson, 'utf-8');
        const questoes = JSON.parse(conteudo);

        // Filtros opcionais
        const { area, quantity, year } = req.query;
        let filtradas = questoes;

        if (area && area !== 'Todas') {
            filtradas = filtradas.filter(q => q.area === area);

        }

        if (year) {
            filtradas = filtradas.filter(q => String(q.ano) === String(year));
        }

        // Limita a quantidade

        const limite = parseInt(quantity) || 10;
        const resultado = filtradas.slice(0, limite);

        console.log(`${resultado.length} questões enviadas para o frontend`);
        res.json(resultado);
        
    }   catch (erro) { 
        console.error(' Erro ao ler questões:', erro);
        res.status(500).json({
            erro: 'Erro ao carregar questôes.'
        });

    } 
});

// ROTA: Resultados (salva no arquivo JSON)


app.post('/api/results', (req, res) => {
    try {
        const caminhoResultados = path.join(__dirname, '..', 'data', 'resultados.json');
        
        // Lê os resultados existentes
        let resultados = [];
        if (fs.existsSync(caminhoResultados)) {
            const conteudo = fs.readFileSync(caminhoResultados, 'utf-8');
            resultados = JSON.parse(conteudo || '[]');
        }

        // Adiciona o novo resultado
        const novoResultado = {
            id: Date.now(),
            nome: req.body.studentName || req.body.name || 'Anônimo',
            turma: req.body.className || req.body.turma || 'Sem turma',
            matricula: req.body.registrationNumber || req.body.matricula || '',
            acertos: req.body.score || req.body.acertos || 0,
            total: req.body.totalQuestions || req.body.total || 0,
            percentual: req.body.percentage || req.body.taxaAcerto || 0,
            tempoSegundos: req.body.totalTimeSeconds || req.body.tempoSegundos || 0,
            data: new Date().toISOString()
        };

        resultados.push(novoResultado);

        // Salva no arquivo
        fs.writeFileSync(caminhoResultados, JSON.stringify(resultados, null, 2));

        console.log(`Resultado salvo: ${novoResultado.nome} (${novoResultado.percentual}%)`);
        res.status(201).json({ sucesso: true, resultado: novoResultado });
    } catch (erro) {
        console.error('Erro ao salvar resultado:', erro);
        res.status(500).json({ erro: 'Erro ao salvar resultado.' });
    }
});

// ROTA: Rankings (lê do arquivo JSON)

app.get('/api/rankings', (req, res) => {
    try {
        const caminhoResultados = path.join(__dirname, '..', 'data', 'resultados.json');
        
        if (!fs.existsSync(caminhoResultados)) {
            return res.json([]);
        }

        const conteudo = fs.readFileSync(caminhoResultados, 'utf-8');
        let resultados = JSON.parse(conteudo || '[]');

        // Filtro por turma (opcional)
        const { className, limit } = req.query;
        if (className && className !== 'Todas') {
            resultados = resultados.filter(r => r.turma === className);
        }

// Ordena por: maior percentual, maior acertos, menor tempo, data mais antiga


        resultados.sort((a, b) => {
            if (b.percentual !== a.percentual) return b.percentual - a.percentual;
            if (b.acertos !== a.acertos) return b.acertos - a.acertos;
            if (a.tempoSegundos !== b.tempoSegundos) return a.tempoSegundos - b.tempoSegundos;
            return new Date(a.data) - new Date(b.data);
        });

        // Limita a quantidade
        
        const limite = parseInt(limit) || 20;
        const ranking = resultados.slice(0, limite);

        console.log(`${ranking.length} resultados enviados para o ranking`);
        res.json(ranking);
    } catch (erro) {
        console.error(' Erro ao ler ranking:', erro);
        res.status(500).json({ erro: 'Erro ao carregar ranking.' });
    }
});

// Inicialização

app.listen(PORT, () => {
    console.log(`\n API do Performance Quest rodando em: http://localhost:${PORT}`);
    console.log(` Teste: http://localhost:${PORT}/api/questions\n`);
});