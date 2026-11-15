import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] || 8000);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };
const allowed = new Set(['index.html', 'styles.css', 'src', 'vendor', 'assets']);
if (process.argv.includes('--qa')) allowed.add('tests');
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    if (pathname === '/health') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ game: 'PLAY NICE', build: '5.0.0-stealth', root })); return; }
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const path = resolve(root, relative);
    if (!allowed.has(relative.split(/[\\/]/)[0]) || !path.startsWith(root + sep)) { response.writeHead(404); response.end('Not found'); return; }
    const info = await stat(path);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Length': info.size });
    createReadStream(path).pipe(response);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`PLAY NICE is running at http://127.0.0.1:${port}`)).on('error', error => { console.error(error.message); process.exitCode = 1; });
