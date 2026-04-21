const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.STORYBOARD_PREVIEW_PORT || process.argv[2] || 12731);
const HOST = '127.0.0.1';
const ROOT = process.env.STORYBOARD_PREVIEW_ROOT || path.join(__dirname, 'assets');
const DEFAULT_PAGE = process.env.STORYBOARD_PREVIEW_PAGE || 'zhihe-storyboard-preview-flashback.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, code, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath);
  const normalized = path.posix.normalize(decoded).replace(/^\/+/, '');
  const abs = path.resolve(root, normalized);
  if (!abs.startsWith(path.resolve(root))) return null;
  return abs;
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      return res.end();
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method Not Allowed');
    }

    if (url.pathname === '/health' || url.pathname === '/healthz') {
      return send(
        res,
        200,
        JSON.stringify({ ok: true, service: 'storyboard-preview-server', port: PORT, root: ROOT, page: DEFAULT_PAGE }, null, 2),
        'application/json; charset=utf-8'
      );
    }

    let reqPath = url.pathname;
    if (reqPath === '/' || reqPath === '') reqPath = `/${DEFAULT_PAGE}`;

    let filePath = safeJoin(ROOT, reqPath);
    if (!filePath) return send(res, 403, 'Forbidden');

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return send(res, 404, `Not Found: ${url.pathname}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });

    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    send(res, 500, `Server Error: ${err.message || String(err)}`);
  }
});

server.on('error', (err) => {
  console.error('[preview] fatal:', err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`[preview] server listening on http://${HOST}:${PORT}`);
  console.log(`[preview] root: ${ROOT}`);
  console.log(`[preview] page: ${DEFAULT_PAGE}`);
  console.log(`[preview] health: http://${HOST}:${PORT}/health`);
});
