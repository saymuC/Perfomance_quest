import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // Redireciona a raiz para o caminho canônico do frontend
  if (reqPath === '/' || reqPath === '/frontend') {
    res.writeHead(302, { Location: '/frontend/index.html' });
    return res.end();
  }

  if (reqPath === '/frontend/') {
    reqPath = '/frontend/index.html';
  }

  let safePath = path.normalize(path.join(__dirname, reqPath));

  // Previne Directory Traversal
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  // Se o arquivo não existir diretamente na raiz, procura dentro da pasta frontend/
  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    const frontendCandidate = path.normalize(path.join(__dirname, 'frontend', reqPath));
    if (frontendCandidate.startsWith(__dirname) && fs.existsSync(frontendCandidate) && fs.statSync(frontendCandidate).isFile()) {
      safePath = frontendCandidate;
    }
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end(`404 Not Found: ${reqPath}`);
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`\n🚀 Performance Quest rodando em: http://localhost:${port}`);
    console.log(`📱 Acesso ao frontend: http://localhost:${port}/frontend/index.html\n`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.log(`⚠️  Porta ${PORT} já está em uso. Tentando porta ${nextPort}...`);
    startServer(nextPort);
  } else {
    console.error('Erro no servidor:', err);
  }
});

startServer(PORT);
