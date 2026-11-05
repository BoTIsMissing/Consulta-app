const test = require('node:test');
const assert = require('node:assert/strict');
const { createPoolManager } = require('./database-pool');

test('requisições simultâneas compartilham uma única conexão inicial e pool limitado', async () => {
  let connects = 0;
  let closes = 0;
  class Pool {
    constructor(config) { assert.equal(config.pool.max, 5); }
    on() {}
    async connect() { connects++; return this; }
    async close() { closes++; }
  }
  const manager = createPoolManager({ loadConfig: async () => ({}), Pool });
  const [first, second] = await Promise.all([manager.getPool(), manager.getPool()]);
  assert.equal(first, second);
  assert.equal(connects, 1);
  assert.equal(closes, 0);
  await manager.close();
  assert.equal(closes, 1);
});

test('uma falha de conexão não impede a recuperação na requisição seguinte', async () => {
  let attempts = 0;
  let closes = 0;
  class Pool {
    on() {}
    async connect() { if (++attempts === 1) throw new Error('connection failed'); return this; }
    async close() { closes++; }
  }
  const manager = createPoolManager({ loadConfig: async () => ({}), Pool });
  await assert.rejects(manager.getPool());
  assert.equal(closes, 1);
  assert.ok(await manager.getPool());
  assert.equal(attempts, 2);
  await manager.close();
});
