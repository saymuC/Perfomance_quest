import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalResultStore, createPostgresStore, createResult, createStudent } from './src/resultStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/questoes_enem_2022_2023.json'), 'utf8'));

function normalizar(valor) {
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizarOrigem(origin) {
  try {
    return new URL(origin).origin;
  } catch {
    return '';
  }
}

function origemPermitida(origin, origins) {
  if (!origin || origins.includes('*')) return true;
  const requestOrigin = normalizarOrigem(origin);
  if (!requestOrigin) return false;
  const allowedOrigins = origins.map(normalizarOrigem);
  if (allowedOrigins.includes(requestOrigin)) return true;

  try {
    const { hostname } = new URL(requestOrigin);
    return allowedOrigins.some(allowedOrigin => {
      if (!allowedOrigin) return false;
      const { hostname: configuredHost } = new URL(allowedOrigin);
      const projectSlug = configuredHost.endsWith('.vercel.app')
        ? configuredHost.slice(0, -'.vercel.app'.length)
        : '';
      return projectSlug && hostname.startsWith(`${projectSlug}-`) && hostname.endsWith('.vercel.app');
    });
  } catch {
    return false;
  }
}

function responder(res, status, data, origin, origins) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (origin && origemPermitida(origin, origins)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  res.writeHead(status, headers);
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

export async function createApiServer({ store, frontendOrigins, dataFile } = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  const origins = frontendOrigins || (process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000']);
  if (isProduction && (!process.env.DATABASE_URL || origins.length === 0)) {
    throw new Error('Em produção, configure DATABASE_URL e FRONTEND_ORIGIN.');
  }
  const resultStore = store || (process.env.DATABASE_URL
    ? await createPostgresStore(process.env.DATABASE_URL, process.env.DATABASE_SSL === 'true')
    : new LocalResultStore(dataFile || process.env.RESULTS_FILE || path.join(__dirname, 'data/results.jsonl')));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const requestOrigin = req.headers.origin;
    if (!origemPermitida(requestOrigin, origins)) {
      return responder(res, 403, { error: 'Origem não permitida.' }, requestOrigin, origins);
    }
    if (req.method === 'OPTIONS') return responder(res, 204, {}, requestOrigin, origins);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return responder(res, 200, { status: 'ok', persistence: resultStore.persistence }, requestOrigin, origins);
    }

    if (req.method === 'GET' && url.pathname === '/api/questions') {
      const year = url.searchParams.get('year') || 'all';
      const quantity = Number(url.searchParams.get('quantity') || 10);
      const area = normalizar(url.searchParams.get('area') || 'Todas');
      if ((year !== 'all' && ![2022, 2023].includes(Number(year))) || !Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
        return responder(res, 400, { error: 'Filtros year ou quantity inválidos.' }, requestOrigin, origins);
      }

      const filtered = questions.filter(question => (
        (year === 'all' || question.ano === Number(year)) && (area === 'todas' || normalizar(question.area).includes(area))
      ));
      return responder(res, 200, { questions: filtered.slice(0, quantity), total: filtered.length }, requestOrigin, origins);
    }

    if (req.method === 'POST' && url.pathname === '/api/students') {
      try {
        const body = await lerJson(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return responder(res, 400, { error: 'O corpo deve ser um objeto JSON.' }, requestOrigin, origins);
        }
        const student = await resultStore.registerStudent(createStudent(body));
        return responder(res, 200, { success: true, student }, requestOrigin, origins);
      } catch (error) {
        if (!error.status) console.error('Falha ao registrar aluno:', error);
        return responder(res, error.status || 500, { error: error.status ? error.message : 'Não foi possível registrar o aluno.' }, requestOrigin, origins);
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/results') {
      try {
        const body = await lerJson(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return responder(res, 400, { error: 'O corpo deve ser um objeto JSON.' }, requestOrigin, origins);
        }
        const result = await resultStore.insert(createResult(body));
        return responder(res, 201, { success: true, result }, requestOrigin, origins);
      } catch (error) {
        if (!error.status) console.error('Falha ao persistir resultado:', error);
        return responder(res, error.status || 500, { error: error.status ? error.message : 'Não foi possível salvar o resultado.' }, requestOrigin, origins);
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/rankings') {
      const className = url.searchParams.get('className');
      const rawLimit = url.searchParams.get('limit') || '20';
      const limit = Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return responder(res, 400, { error: 'O limite deve ser um inteiro entre 1 e 100.' }, requestOrigin, origins);
      }
      return responder(res, 200, await resultStore.rankings({ className, limit }), requestOrigin, origins);
    }

    return responder(res, 404, { error: 'Rota não encontrada.' }, requestOrigin, origins);
  });
  server.on('close', () => resultStore.close?.());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001);
  createApiServer().then(server => {
    server.listen(port, () => console.log(`Performance Quest API em http://localhost:${port}/api`));
    process.on('SIGINT', () => server.close(() => process.exit(0)));
    process.on('SIGTERM', () => server.close(() => process.exit(0)));
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
