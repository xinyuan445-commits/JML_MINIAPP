import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { createServer as createHttpsServer, request as httpsRequest } from 'node:https';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('.', import.meta.url));
const distDirectory = resolve(projectDirectory, 'dist');
const port = readPort(process.env.PORT, 8890);
const host = process.env.HOST?.trim() || '0.0.0.0';
const apiMode = process.env.DASHBOARD_API_MODE?.trim().toLowerCase() || 'embedded';
const embeddedApiPort = readPort(process.env.DASHBOARD_API_PORT, 8891);
const httpsPfxPath = resolve(
  projectDirectory,
  process.env.HTTPS_PFX_PATH?.trim() || 'certs/board.jml.goldenchameleon.cn.pfx',
);
const httpsEnabled = existsSync(httpsPfxPath);
const publicProtocol = httpsEnabled ? 'https' : 'http';
const apiTarget = new URL(
  apiMode === 'external'
    ? process.env.DASHBOARD_API_TARGET?.trim() || 'http://127.0.0.1:5001'
    : `http://127.0.0.1:${embeddedApiPort}`,
);

if (!['http:', 'https:'].includes(apiTarget.protocol)) {
  throw new Error('DASHBOARD_API_TARGET 仅支持 http:// 或 https://');
}

if (!['embedded', 'external'].includes(apiMode)) {
  throw new Error('DASHBOARD_API_MODE 仅支持 embedded 或 external');
}

let embeddedApi = null;
let stopping = false;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function readPort(value, fallback) {
  const candidate = Number(value);
  return Number.isInteger(candidate) && candidate > 0 && candidate <= 65535
    ? candidate
    : fallback;
}

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function proxyApi(request, response) {
  const upstreamUrl = new URL(request.url || '/', apiTarget);
  const requester = upstreamUrl.protocol === 'https:' ? httpsRequest : httpRequest;
  const headers = { ...request.headers, host: upstreamUrl.host };
  delete headers.connection;
  delete headers['content-length'];

  const upstream = requester(
    upstreamUrl,
    {
      method: request.method,
      headers,
      timeout: 65000,
    },
    (upstreamResponse) => {
      const responseHeaders = { ...upstreamResponse.headers };
      delete responseHeaders.connection;
      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on('timeout', () => upstream.destroy(new Error('上游接口超时')));
  upstream.on('error', () => {
    if (!response.headersSent) {
      json(response, 502, { code: 502, msg: '生产看板数据服务暂不可用' });
    } else {
      response.destroy();
    }
  });
  request.pipe(upstream);
}

function safeFile(pathname) {
  try {
    const decoded = decodeURIComponent(pathname);
    const relativePath = normalize(decoded).replace(/^([/\\])+/, '');
    const candidate = resolve(distDirectory, relativePath);
    return candidate === distDirectory || candidate.startsWith(`${distDirectory}${sep}`)
      ? candidate
      : null;
  } catch {
    return null;
  }
}

function sendFile(request, response, filePath) {
  const stat = statSync(filePath);
  const cache = filePath.endsWith('index.html')
    ? 'no-cache'
    : /\.[a-f0-9]{8,}\./i.test(filePath)
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=300';
  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': cache,
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(filePath).pipe(response);
}

function serveStatic(request, response) {
  const url = new URL(request.url || '/', 'http://dashboard.local');
  let filePath = safeFile(url.pathname === '/' ? '/index.html' : url.pathname);
  if (filePath && existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    if (extname(url.pathname)) {
      return json(response, 404, { code: 404, msg: '文件不存在' });
    }
    filePath = join(distDirectory, 'index.html');
  }
  if (!existsSync(filePath)) {
    return json(response, 503, {
      code: 503,
      msg: '尚未生成看板文件，请先执行 npm run build',
    });
  }
  sendFile(request, response, filePath);
}

const requestHandler = (request, response) => {
  const pathname = new URL(request.url || '/', 'http://dashboard.local').pathname;
  if (pathname === '/healthz') {
    return json(response, 200, {
      status: 'ok',
      service: 'jml-production-dashboard',
      https_enabled: httpsEnabled,
      api_mode: apiMode,
      api_target: apiTarget.origin,
    });
  }
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return proxyApi(request, response);
  }
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    return json(response, 405, { code: 405, msg: '请求方式不支持' });
  }
  return serveStatic(request, response);
};

const server = httpsEnabled
  ? createHttpsServer({
      pfx: readFileSync(httpsPfxPath),
      passphrase: process.env.HTTPS_PFX_PASSPHRASE || undefined,
    }, requestHandler)
  : createHttpServer(requestHandler);

function startEmbeddedApi() {
  if (apiMode !== 'embedded') return;
  const python = process.env.DASHBOARD_PYTHON?.trim() || 'python';
  const script = join(projectDirectory, 'api', 'app.py');
  embeddedApi = spawn(
    python,
    [script, '--host', '127.0.0.1', '--port', String(embeddedApiPort)],
    {
      cwd: projectDirectory,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  embeddedApi.stdout.on('data', (data) => process.stdout.write(data));
  embeddedApi.stderr.on('data', (data) => process.stderr.write(data));
  embeddedApi.on('error', (error) => {
    console.error(`[看板API] 启动失败：${error.message}`);
  });
  embeddedApi.on('exit', (code, signal) => {
    embeddedApi = null;
    if (stopping) return;
    console.error(`[看板API] 已退出（code=${code ?? '-'}, signal=${signal ?? '-'}）`);
    if (server.listening) server.close(() => process.exit(1));
    else process.exit(1);
    setTimeout(() => process.exit(1), 2000).unref();
  });
}

function probeApi() {
  return new Promise((resolve) => {
    const healthUrl = new URL('/healthz', apiTarget);
    const requester = healthUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = requester(healthUrl, { method: 'GET', timeout: 1000 }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
    request.end();
  });
}

async function waitForApi() {
  if (apiMode !== 'embedded') return;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await probeApi()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('内置看板API未能在10秒内就绪');
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  if (embeddedApi) embeddedApi.kill();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
  console.log(`[看板] 收到 ${signal}，正在停止`);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

function accessUrls() {
  const urls = new Set([`${publicProtocol}://127.0.0.1:${port}`]);
  if (host === '0.0.0.0' || host === '::') {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses || []) {
        if (address.family === 'IPv4' && !address.internal) {
          urls.add(`${publicProtocol}://${address.address}:${port}`);
        }
      }
    }
  } else {
    urls.add(`${publicProtocol}://${host}:${port}`);
  }
  return [...urls];
}

async function start() {
  startEmbeddedApi();
  try {
    await waitForApi();
  } catch (error) {
    console.error(`[看板] ${error.message}`);
    if (embeddedApi) embeddedApi.kill();
    process.exit(1);
  }
  server.listen(port, host, () => {
    console.log('[看板] 生产现场看板已启动');
    for (const url of accessUrls()) console.log(`[看板] ${url}`);
    console.log(`[看板] API (${apiMode}) -> ${apiTarget.origin}`);
  });
}

start();
