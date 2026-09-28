import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/questoes_enem_2023.json'), 'utf8'))
  .filter(question => !question.enunciado.includes('broken-image.svg') && question.alternativas.every(alternative => (
    String(alternative.texto || '').trim() || alternative.imagem
  )));
const results = [];

function normalizar(valor) {
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function responder(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

async function lerJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw Object.assign(new Error('Corpo da requisição muito grande.'), { status: 413 });
  }
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error('JSON inválido.'), { status: 400 });
  }
}

export function createApiServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') return responder(res, 204, {});

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return responder(res, 200, { status: 'ok', persistence: 'memory' });
    }

    if (req.method === 'GET' && url.pathname === '/api/questions') {
      const year = Number(url.searchParams.get('year') || 2023);
      const quantity = Number(url.searchParams.get('quantity') || 10);
      const area = normalizar(url.searchParams.get('area') || 'Todas');
      if (!Number.isInteger(year) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return responder(res, 400, { error: 'Filtros year ou quantity inválidos.' });
      }

      const filtered = questions.filter(question => (
        question.ano === year && (area === 'todas' || normalizar(question.area).includes(area))
      ));
      return responder(res, 200, { questions: filtered.slice(0, quantity), total: filtered.length });
    }

    if (req.method === 'POST' && url.pathname === '/api/results') {
      try {
        const body = await lerJson(req);
        const name = String(body.studentName || body.name || '').trim();
        const className = String(body.className || body.turma || '').trim();
        const registrationNumber = String(body.registrationNumber || body.matricula || '').trim();
        const score = Number(body.score ?? body.acertos);
        const totalQuestions = Number(body.totalQuestions ?? body.total);
        const totalTimeSeconds = Number(body.totalTimeSeconds ?? body.tempoSegundos ?? 0);
        if (!name || !className || !registrationNumber || !Number.isInteger(score) || !Number.isInteger(totalQuestions) || totalQuestions < 1 || score < 0 || score > totalQuestions || !Number.isFinite(totalTimeSeconds) || totalTimeSeconds < 0) {
          return responder(res, 400, { error: 'Dados do resultado inválidos ou incompletos.' });
        }

        const result = {
          id: results.length + 1,
          studentName: name,
          name,
          className,
          registrationNumber,
          score,
          totalQuestions,
          percentage: Math.round((score / totalQuestions) * 100),
          totalTimeSeconds,
          answers: Array.isArray(body.answers) ? body.answers : [],
          createdAt: body.createdAt || new Date().toISOString()
        };
        results.push(result);
        return responder(res, 201, { success: true, result });
      } catch (error) {
        return responder(res, error.status || 400, { error: error.message });
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/rankings') {
      const className = url.searchParams.get('className');
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 100);
      if (className) {
        const turma = normalizar(className);
        const filtered = results.filter(result => normalizar(result.className) === turma);
        filtered.sort((a, b) => b.percentage - a.percentage || b.score - a.score || a.totalTimeSeconds - b.totalTimeSeconds || Date.parse(a.createdAt) - Date.parse(b.createdAt));
        return responder(res, 200, filtered.slice(0, limit));
      }
      const ranking = [...results].sort((a, b) => b.percentage - a.percentage || b.score - a.score || a.totalTimeSeconds - b.totalTimeSeconds || Date.parse(a.createdAt) - Date.parse(b.createdAt));
      return responder(res, 200, ranking.slice(0, limit));
    }

    return responder(res, 404, { error: 'Rota não encontrada.' });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001);
  createApiServer().listen(port, () => console.log(`Performance Quest API em http://localhost:${port}/api`));
}
