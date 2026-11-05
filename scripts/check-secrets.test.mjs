import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const checker = fileURLToPath(new URL('./check-secrets.mjs', import.meta.url));
function check(file, content, updatedContent) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'consulta-secrets-test-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: directory, windowsHide: true });
    fs.writeFileSync(path.join(directory, file), content);
    execFileSync('git', ['add', '--', file], { cwd: directory, windowsHide: true });
    if (updatedContent) fs.writeFileSync(path.join(directory, file), updatedContent);
    return spawnSync(process.execPath, [checker], { cwd: directory, encoding: 'utf8', windowsHide: true });
  } finally {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('consulta-secrets-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

test('configuração pública Firebase é permitida', () => {
  assert.equal(check('config.ts', "export const config = { apiKey: 'public-identifier' };").status, 0);
});

test('arquivo de credenciais é bloqueado sem imprimir seus valores', () => {
  const result = check('fr-base.json', '{"password":"secret-not-for-logs"}');
  assert.equal(result.status, 1);
  assert.equal(result.stderr.includes('secret-not-for-logs'), false);
});

test('chave privada inserida depois do stage também é bloqueada', () => {
  const body = ['-----BEGIN PRIVATE KEY-----', 'A'.repeat(100), '-----END PRIVATE KEY-----'].join('\n');
  const result = check('config.txt', 'safe', body);
  assert.equal(result.status, 1);
  assert.equal(result.stderr.includes('A'.repeat(100)), false);
});

test('arquivo de exemplo não permite contornar a detecção de chave privada', () => {
  const body = ['-----BEGIN PRIVATE KEY-----', 'A'.repeat(100), '-----END PRIVATE KEY-----'].join('\n');
  assert.equal(check('.env.example', body).status, 1);
});
