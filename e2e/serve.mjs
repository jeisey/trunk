// Serves dist/ under a non-root base path (default /trunk/), like GitHub Pages
// project sites. No rewrites: unknown paths 404, as on Pages. Text assets are
// gzip-compressed when the client accepts it, as GitHub Pages does.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const port = Number(process.env.PORT ?? 4174);
const base = process.env.BASE_PATH ?? '/trunk/';
const root = join(import.meta.dirname, '..', 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.txt': 'text/plain' };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === base.slice(0, -1)) {
    res.writeHead(301, { location: base });
    return res.end();
  }
  if (!url.pathname.startsWith(base)) {
    res.writeHead(404);
    return res.end('Not found (outside base path)');
  }
  let rel = normalize(decodeURIComponent(url.pathname.slice(base.length)));
  if (rel.startsWith('..')) {
    res.writeHead(400);
    return res.end();
  }
  if (rel === '.' || rel === '' || rel.endsWith('/')) rel = join(rel, 'index.html');
  const file = join(root, rel);
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    const type = types[extname(file)] ?? 'application/octet-stream';
    let body = await readFile(file);
    const headers = { 'content-type': type, 'cache-control': 'no-cache', vary: 'accept-encoding' };
    if (/text|javascript|json|svg/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      body = gzipSync(body);
      headers['content-encoding'] = 'gzip';
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, () => console.log(`Serving dist at http://localhost:${port}${base}`));
