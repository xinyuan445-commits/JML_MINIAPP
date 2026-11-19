const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');

const adminDir = path.resolve(__dirname, '..');
const webApiDir = path.resolve(adminDir, 'webapi');
const webApiEntry = path.join(webApiDir, 'app.py');
const healthUrl = 'http://127.0.0.1:5001/healthz';
const isWindows = process.platform === 'win32';
const pythonCommand = process.env.WEBAPI_PYTHON || (isWindows ? 'python' : 'python3');
const projectKey = createHash('sha256').update(adminDir.toLowerCase()).digest('hex').slice(0, 16);
const controlPipe = `\\\\.\\pipe\\jml-admin-${projectKey}`;

let backend;
let frontend;
let proxyCleanup;
let reportEmailScheduler;
let dailyTaskSnapshotWorker;
let shuttingDown = false;
let ownsBackend = false;
let restarting;

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function isWebApiHealthy() {
  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return body?.status === 'ok';
  } catch {
    return false;
  }
}

async function waitForHealth(check, timeoutMilliseconds) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await delay(300);
  }
  return false;
}

function stopProcessTree(child) {
  if (!child?.pid || child.exitCode != null || child.signalCode != null) return true;
  if (isWindows) {
    const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return result.status === 0;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
  return true;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopProcessTree(frontend);
  stopProcessTree(backend);
  stopProcessTree(proxyCleanup);
  stopProcessTree(reportEmailScheduler);
  stopProcessTree(dailyTaskSnapshotWorker);
  process.exit(exitCode);
}

function startFrontend() {
  const maxEntry = require.resolve('@umijs/max/bin/max');
  const child = spawn(process.execPath, [maxEntry, 'dev'], {
    cwd: adminDir,
    env: {
      ...process.env,
      MOCK: 'none',
      PORT: '8886',
      UMI_ENV: 'dev',
    },
    stdio: 'inherit',
    windowsHide: true,
    detached: !isWindows,
  });
  frontend = child;
  watchService(child, 'frontend');
}

function startBackend() {
  const child = spawn(pythonCommand, [webApiEntry], {
    cwd: webApiDir,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
    detached: !isWindows,
  });
  backend = child;
  watchService(child, 'backend');
}

function startSnapshotWorker() {
  stopProcessTree(dailyTaskSnapshotWorker);
  dailyTaskSnapshotWorker = spawn(pythonCommand, [path.join(webApiDir, 'daily_task_snapshot_worker.py'), '--loop'], {
    cwd: webApiDir, env: process.env, stdio: 'inherit', windowsHide: true, detached: !isWindows,
  });
  dailyTaskSnapshotWorker.once('error', () => console.error('[jml] 任务快照服务启动失败，请检查初始化和 Python 配置。'));
  dailyTaskSnapshotWorker.once('exit', () => {
    if (!shuttingDown && !restarting) console.error('[jml] 任务快照服务已退出，请检查启动窗口。');
  });
}

function watchService(child, target) {
  const exited = (code, detail) => {
    if (shuttingDown || child !== (target === 'frontend' ? frontend : backend)) return;
    if (target === 'frontend') frontend = undefined;
    else backend = undefined;
    console.error(`[jml] ${target} 已退出（${detail}）。`);
    if (restarting !== target) shutdown(code);
  };
  child.once('error', (error) => exited(1, error.message));
  child.once('exit', (code, signal) => exited(code ?? 1, signal || `code ${code ?? 1}`));
}

async function restartService(target) {
  if (restarting) throw new Error('已有服务正在重启，请稍后再试。');
  if (target === 'backend' && !ownsBackend) {
    throw new Error('5001 WebAPI 由其他进程启动，请在原启动窗口重启。');
  }
  restarting = target;
  try {
    if (target === 'frontend') {
      if (!stopProcessTree(frontend)) throw new Error('无法停止当前前端进程。');
      startFrontend();
      const ready = await waitForHealth(async () => {
        if (!frontend) throw new Error('前端进程已退出，请查看 npm start 窗口。');
        try {
          return (await fetch('http://127.0.0.1:8886/', { signal: AbortSignal.timeout(1500) })).ok;
        } catch {
          return false;
        }
      }, 45000);
      if (!ready) throw new Error('前端仍未就绪，请查看 npm start 窗口。');
      return '前端已重启，8886 可访问。';
    }
    if (!stopProcessTree(backend)) throw new Error('无法停止当前 WebAPI 进程。');
    startBackend();
    const ready = await waitForHealth(() => {
      if (!backend) throw new Error('WebAPI 进程已退出，请查看 npm start 窗口。');
      return isWebApiHealthy();
    }, 15000);
    if (!ready) throw new Error('WebAPI 仍未就绪，请查看 npm start 窗口。');
    startSnapshotWorker();
    return 'WebAPI 已重启，5001 健康检查通过。';
  } finally {
    restarting = undefined;
  }
}

function listenForRestarts() {
  const server = net.createServer((socket) => {
    let request = '';
    socket.on('error', () => socket.destroy());
    socket.setTimeout(55000, () => socket.destroy());
    socket.on('data', (chunk) => {
      request += chunk.toString();
      if (request.length > 16) return socket.destroy();
      if (!request.endsWith('\n')) return;
      socket.removeAllListeners('data');
      const target = request.trim();
      if (target !== 'frontend' && target !== 'backend') {
        socket.end(JSON.stringify({ error: '未知的服务。' }));
        return;
      }
      restartService(target).then(
        (message) => socket.end(JSON.stringify({ message })),
        (error) => socket.end(JSON.stringify({ error: error.message })),
      );
    });
  });
  server.on('error', (error) => console.error(`[jml] 独立重启接口启动失败：${error.message}`));
  server.listen(controlPipe);
}

function requestRestart(target) {
  const socket = net.createConnection(controlPipe, () => socket.write(`${target}\n`));
  let reply = '';
  socket.setEncoding('utf8');
  socket.setTimeout(55000, () => socket.destroy(new Error('等待重启结果超时。')));
  socket.on('data', (chunk) => { reply += chunk; });
  socket.on('end', () => {
    if (!reply) {
      console.error('启动器未返回重启结果，请查看 npm start 窗口。');
      process.exitCode = 1;
      return;
    }
    const result = JSON.parse(reply);
    if (result.error) {
      console.error(result.error);
      process.exitCode = 1;
    } else {
      console.log(result.message);
    }
  });
  socket.on('error', (error) => {
    console.error(error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
      ? '未找到支持独立重启的启动器，请先在原窗口停止服务，再运行一次 npm start。'
      : error.message);
    process.exitCode = 1;
  });
}

async function main() {
  const alreadyRunning = await isWebApiHealthy();
  if (alreadyRunning) {
    console.log('[jml] WebAPI 已在 http://127.0.0.1:5001 运行，继续启动前端。');
  } else {
    ownsBackend = true;
    startBackend();
    if (!(await waitForHealth(isWebApiHealthy, 15000))) {
      throw new Error('WebAPI 启动失败');
    }
    console.log('[jml] WebAPI 已启动：http://127.0.0.1:5001');
  }

  proxyCleanup = spawn(
    pythonCommand,
    [path.join(webApiDir, 'cleanup_station_proxies.py'), '--loop'],
    {
      cwd: webApiDir,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
      detached: !isWindows,
    },
  );
  proxyCleanup.once('error', () => {
    console.error('[jml] 代理清理任务启动失败，请检查 Python 配置。');
  });
  proxyCleanup.once('exit', () => {
    if (!shuttingDown)
      console.error('[jml] 代理清理任务已退出，请重新启动后台。');
  });

  reportEmailScheduler = spawn(
    pythonCommand,
    [path.join(webApiDir, 'report_email_scheduler.py'), '--loop'],
    {
      cwd: webApiDir,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
      detached: !isWindows,
    },
  );
  reportEmailScheduler.once('error', () => {
    console.error('[jml] 报表邮件定时任务启动失败，请检查 Python 配置。');
  });
  reportEmailScheduler.once('exit', () => {
    if (!shuttingDown)
      console.error('[jml] 报表邮件定时任务已退出，请重新启动后台。');
  });

  startSnapshotWorker();
  startFrontend();
  if (isWindows) listenForRestarts();
}

if (process.argv[2] === '--restart') {
  requestRestart(process.argv[3]);
} else {
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
  process.on('exit', () => {
    if (shuttingDown) return;
    stopProcessTree(frontend);
    stopProcessTree(backend);
    stopProcessTree(proxyCleanup);
    stopProcessTree(reportEmailScheduler);
  stopProcessTree(dailyTaskSnapshotWorker);
  });

  main().catch((error) => {
    console.error(`[jml] ${error.message}`);
    shutdown(1);
  });
}
