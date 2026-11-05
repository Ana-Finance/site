// Serveur statique minimal imitant GitHub Pages sous un chemin de base (/site/).
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml' };
export function startStatic(dir, port = 4173, base = '/site/') {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith(base)) { res.writeHead(404); return res.end('404'); }
    let file = normalize(join(dir, decodeURIComponent(url.pathname.slice(base.length))));
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end(existsSync(join(dir, '404.html')) ? readFileSync(join(dir, '404.html')) : '404'); }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}
