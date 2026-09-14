/**
 * The static server the e2e suite runs against — deliberately not `vite
 * preview`, which knows about SvelteKit's routing. GitHub Pages serves plain
 * files and answers an unknown path with `404.html` (status 404), and that
 * file is our SPA fallback: `/practice/<id>/` only exists because of it. Only
 * a dumb file server exercises that path, so this is the one that does.
 *
 * Usage: `node e2e/static-server.mjs [port] [dir]`.
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] ?? 4173);
const root = process.argv[3] ?? 'build';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function resolve(urlPath) {
  // No traversal outside the build directory, exactly like a static host.
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(
    /^(\.\.[/\\])+/,
    '',
  );
  const candidates = [join(root, clean)];
  if (clean.endsWith('/')) candidates.push(join(root, clean, 'index.html'));
  else
    candidates.push(
      join(root, `${clean}.html`),
      join(root, clean, 'index.html'),
    );
  return candidates.find((path) => existsSync(path) && statSync(path).isFile());
}

createServer((request, response) => {
  const file = resolve(request.url ?? '/');
  if (file) {
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    createReadStream(file).pipe(response);
    return;
  }
  // Unknown path → the SPA fallback, with the status Pages really returns.
  const fallback = join(root, '404.html');
  if (existsSync(fallback)) {
    response.writeHead(404, { 'content-type': TYPES['.html'] });
    createReadStream(fallback).pipe(response);
    return;
  }
  response.writeHead(404, { 'content-type': 'text/plain' });
  response.end('Not found');
}).listen(port);
