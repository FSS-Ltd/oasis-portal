import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const distDir = path.resolve(process.cwd(), process.argv[2] ?? 'dist');
const port = Number(process.env.PORT ?? process.env.MOBILE_PWA_PORT ?? 8081);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

if (!fs.existsSync(distDir)) {
  console.error(`Cannot serve ${distDir}. Run pnpm --filter @oasis/mobile build:web first.`);
  process.exit(1);
}

function resolveFilePath(requestUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(requestUrl ?? '/', 'http://localhost');
  } catch {
    return null;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsedUrl.pathname);
  } catch {
    return null;
  }

  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const requestedPath = path.resolve(distDir, relativePath);
  const relativeToDist = path.relative(distDir, requestedPath);

  if (relativeToDist.startsWith('..') || path.isAbsolute(relativeToDist)) return null;
  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) return requestedPath;
  if (path.extname(requestedPath) === '') return path.join(distDir, 'index.html');

  return null;
}

const server = http.createServer((request, response) => {
  const filePath = resolveFilePath(request.url);

  if (!filePath || !fs.existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const contentType = contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream';
  response.writeHead(200, { 'content-type': contentType });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  const scriptName = path.basename(fileURLToPath(import.meta.url));
  console.log(`${scriptName} serving ${distDir} at http://127.0.0.1:${String(port)}`);
});
