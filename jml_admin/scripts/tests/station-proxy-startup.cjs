const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

async function launch(existingBackend) {
  const children = [];
  const killed = [];
  const exits = [];
  let connectToLauncher;
  const fakeProcess = new EventEmitter();
  Object.assign(fakeProcess, {
    platform: 'win32',
    argv: ['node', 'start-with-webapi.js'],
    env: {},
    execPath: 'node',
    exit: (code) => exits.push(code),
  });
  const fakeRequire = (name) =>
    name === 'node:child_process'
      ? {
          spawn: (command, args, options) => {
            const child = new EventEmitter();
            Object.assign(child, {
              pid: 1000 + children.length,
              command,
              args,
              options,
            });
            children.push(child);
            return child;
          },
          spawnSync: (_command, args) => {
            const pid = Number(args[1]);
            killed.push(pid);
            setImmediate(() => children.find((child) => child.pid === pid)?.emit('exit', 1));
            return { status: 0 };
          },
        }
      : name === 'node:net'
      ? {
          createServer: (onConnection) => {
            connectToLauncher = onConnection;
            return Object.assign(new EventEmitter(), { listen() {} });
          },
        }
      : require(name);
  fakeRequire.resolve = () => 'max.js';
  let healthChecks = 0;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../start-with-webapi.js'), 'utf8'),
    {
      require: fakeRequire,
      __dirname: path.resolve(__dirname, '..'),
      process: fakeProcess,
      console: { log() {}, error() {} },
      AbortSignal,
      setTimeout,
      fetch: async () => ({
        ok: existingBackend || healthChecks++ > 0,
        json: async () => ({ status: 'ok' }),
      }),
    },
  );
  await new Promise((resolve) => setImmediate(resolve));
  const restart = (target) => new Promise((resolve) => {
    const socket = Object.assign(new EventEmitter(), {
      setTimeout() {},
      end: (reply) => resolve(JSON.parse(reply)),
    });
    connectToLauncher(socket);
    socket.emit('data', Buffer.from(`${target}\n`));
  });
  return { children, killed, exits, fakeProcess, restart };
}

test('existing WebAPI is reused; cleanup starts automatically and is stopped with frontend', async () => {
  const { children, killed, exits } = await launch(true);
  assert.equal(children.length, 3);
  const [cleanup, scheduler, frontend] = children;
  assert.ok(cleanup.args[0].endsWith('cleanup_station_proxies.py'));
  assert.equal(cleanup.args[1], '--loop');
  assert.equal(cleanup.options.windowsHide, true);
  cleanup.emit('error', new Error('unavailable'));
  assert.deepEqual(exits, []); // Cleanup failure does not stop original permissions/backend.
  frontend.emit('exit', 0);
  assert.deepEqual(killed, [cleanup.pid, scheduler.pid]);
  assert.deepEqual(exits, [0]);
});

test('startup-owned backend, frontend and cleanup all stop on shutdown', async () => {
  const { children, killed, exits, fakeProcess } = await launch(false);
  assert.equal(children.length, 4);
  fakeProcess.emit('SIGINT');
  assert.deepEqual(
    [...killed].sort(),
    children.map((child) => child.pid).sort(),
  );
  assert.deepEqual(exits, [0]);
});

test('frontend and WebAPI can be restarted independently inside npm start', async () => {
  const { children, killed, exits, restart } = await launch(false);
  const [backend, , , frontend] = children;
  assert.match((await restart('frontend')).message, /8886/);
  assert.deepEqual(killed, [frontend.pid]);
  assert.match((await restart('backend')).message, /5001/);
  assert.deepEqual(killed, [frontend.pid, backend.pid]);
  assert.deepEqual([...children[4].args], ['max.js', 'dev']);
  assert.ok(children[5].args[0].endsWith('webapi' + path.sep + 'app.py'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(exits, []);
});

test('backend restart does not stop a WebAPI reused from another launcher', async () => {
  const { killed, restart } = await launch(true);
  assert.match((await restart('backend')).error, /其他进程/);
  assert.deepEqual(killed, []);
});
