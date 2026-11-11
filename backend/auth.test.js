const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthMiddleware } = require('./auth');

async function request({ token, user, error } = {}) {
  let verified = false;
  const middleware = createAuthMiddleware({
    async verifyToken(value) {
      verified = true;
      assert.equal(value, token);
      if (error) throw error;
      return user;
    },
  });
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const result = { status: 200, next: false, verified: false, headers: {} };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  };
  await middleware(req, res, () => { result.next = true; });
  result.verified = verified;
  result.user = req.user;
  return result;
}

test('bloqueia consultas sem token antes de acessar serviços externos', async () => {
  const result = await request();
  assert.equal(result.status, 401);
  assert.equal(result.next, false);
  assert.equal(result.verified, false);
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('rejeita token inválido, expirado ou revogado', async () => {
  for (const code of ['auth/argument-error', 'auth/id-token-expired', 'auth/id-token-revoked']) {
    const result = await request({ token: 'invalid', error: Object.assign(new Error(), { code }) });
    assert.equal(result.status, 401);
    assert.equal(result.next, false);
  }
});

test('resposta de verificação sem UID não concede acesso nem interrompe o processo', async () => {
  for (const user of [undefined, null, {}, { email: 'test@example.com', panelAccess: true }]) {
    const result = await request({ token: 'token', user });
    assert.equal(result.status, 403);
    assert.equal(result.next, false);
  }
});

test('não libera a API quando o Firebase está sem configuração', async () => {
  const result = await request({
    token: 'token', error: Object.assign(new Error(), { code: 'auth/not-configured' }),
  });
  assert.equal(result.status, 503);
  assert.equal(result.next, false);
});

test('contas sem liberação do administrador não acessam o painel', async () => {
  for (const panelAccess of [undefined, false, 'true']) {
    const result = await request({
      token: 'valid', user: {
        email: 'visitor@example.com', firebase: { sign_in_provider: 'password' }, panelAccess,
      },
    });
    assert.equal(result.status, 403);
    assert.equal(result.next, false);
  }
});

test('libera conta por senha autorizada pelo administrador mesmo sem verificação de e-mail', async () => {
  const user = {
    uid: 'user-id', email: 'Owner@example.com', email_verified: false,
    firebase: { sign_in_provider: 'password' }, panelAccess: true,
  };
  const result = await request({ token: 'valid', user });
  assert.equal(result.status, 200);
  assert.equal(result.next, true);
  assert.equal(result.user, user);
});

test('rejeita login Google, anônimo e conta sem e-mail mesmo com liberação', async () => {
  for (const provider of ['google.com', 'anonymous', undefined]) {
    const result = await request({ token: 'valid', user: {
      email: 'visitor@example.com', panelAccess: true, firebase: { sign_in_provider: provider },
    } });
    assert.equal(result.status, 403);
  }
  assert.equal((await request({ token: 'valid', user: {
    panelAccess: true, firebase: { sign_in_provider: 'password' },
  } })).status, 403);
});

test('liberação administrativa preserva outras permissões e usa o UID da conta existente', async () => {
  const { authorizeUser } = require('./authorize-user');
  const writes = [];
  const auth = {
    async getUserByEmail(email) {
      assert.equal(email, 'user@example.com');
      return {
        uid: 'existing-user', providerData: [{ providerId: 'password' }],
        customClaims: { anotherPermission: true }, disabled: false,
      };
    },
    async setCustomUserClaims(uid, claims) { writes.push({ uid, claims }); },
  };
  await authorizeUser(auth, ' user@example.com ');
  assert.deepEqual(writes, [{
    uid: 'existing-user', claims: { anotherPermission: true, panelAccess: true },
  }]);
});

test('não libera conta inexistente, desativada ou sem senha', async () => {
  const { authorizeUser } = require('./authorize-user');
  for (const user of [null, { disabled: true, providerData: [{ providerId: 'password' }] },
    { disabled: false, providerData: [{ providerId: 'google.com' }] }]) {
    const auth = {
      async getUserByEmail() {
        if (!user) throw new Error('Conta não encontrada');
        return user;
      },
      async setCustomUserClaims() { assert.fail('Não deve liberar a conta'); },
    };
    await assert.rejects(() => authorizeUser(auth, 'user@example.com'));
  }
});

test('todas as rotas de consulta e sessão exigem autenticação via HTTP', async () => {
  const app = require('./server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const health = await fetch(`http://127.0.0.1:${server.address().port}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const root = await fetch(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(root.status, 200);
    assert.deepEqual(await root.json(), { service: 'Consulta BR API', status: 'ok' });
    const missing = await fetch(`http://127.0.0.1:${server.address().port}/missing`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { erro: 'Rota não encontrada.' });
    for (const route of ['/buscar-nome?termo=TESTE', '/buscar-cpf?termo=01234567890',
      '/buscar-id?id=1', '/buscar-endereco?termo=TESTE', '/buscar-placa', '/buscar-cnpj', '/auth/session']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`);
      assert.equal(response.status, 401, route);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
