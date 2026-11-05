const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createInterface } = require('node:readline/promises');

function getDocumentsDirectory() {
  // Resolve a pasta real do Windows, inclusive quando redirecionada ao OneDrive.
  try {
    const documents = execFileSync('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      "[Environment]::GetFolderPath('MyDocuments')",
    ], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (documents) return documents;
  } catch {
    // Compatibilidade com computadores sem PowerShell disponível no PATH.
  }
  return path.join(process.env.USERPROFILE || require('node:os').homedir(), 'Documents');
}

function validateEmail(value) {
  const email = value.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('Digite um e-mail válido. Nenhuma conta foi alterada.');
    error.code = 'input/invalid-email';
    throw error;
  }
  return email;
}

async function releaseEmail(value, { documentsDirectory = getDocumentsDirectory(), grant } = {}) {
  const email = validateEmail(value);
  const filename = path.join(documentsDirectory, 'fr-base.json');
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    const error = new Error(`Arquivo não encontrado: ${filename}\nColoque o JSON privado do Firebase na pasta Documentos com o nome fr-base.json.`);
    error.code = 'input/missing-credentials';
    throw error;
  }

  // O e-mail nunca é interpolado em um comando de shell.
  const previousCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = filename;
  try {
    if (grant) return await grant(email);
    const { getFirebaseAuth } = require('./auth');
    const { authorizeUser } = require('./authorize-user');
    await authorizeUser(getFirebaseAuth(), email);
  } finally {
    if (previousCredentials === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousCredentials;
  }
}

async function main() {
  console.log('Consulta BR — liberar acesso ao painel');
  console.log('A conta deve ter sido criada no Firebase com e-mail e senha.\n');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let email;
  try {
    email = validateEmail(await prompt.question('E-mail do usuário: '));
  } finally {
    prompt.close();
  }
  console.log('\nVerificando a conta e liberando acesso...');
  await releaseEmail(email);
  console.log('\nAcesso liberado. O usuário deve sair da conta no site e entrar novamente.');
}

function printError(error) {
  if (error.code === 'input/invalid-email' || error.code === 'input/missing-credentials') {
    console.error(`\n${error.message}`);
    return;
  }
  const messages = {
    'auth/user-not-found': 'Conta não encontrada. Cadastre esse e-mail no Firebase antes de liberar o acesso.',
    'auth/invalid-email': 'O Firebase não aceitou esse e-mail. Confira o endereço digitado.',
    'auth/not-configured': 'O fr-base.json não é uma credencial administrativa válida. Use o JSON privado original baixado do Firebase.',
    'auth/insufficient-permission': 'A conta de serviço não tem permissão para liberar usuários no Firebase.',
    'MODULE_NOT_FOUND': 'Dependências não encontradas. Na raiz do projeto, execute: npm.cmd --prefix backend install',
  };
  console.error(`\n${messages[error.code] || 'Não foi possível liberar o acesso. Confira a credencial, a conexão e as permissões da conta no Firebase.'}`);
  if (error.message === 'A conta precisa estar ativa e ter login por e-mail e senha.') {
    console.error(error.message);
  }
}

if (require.main === module) {
  main().catch(error => {
    printError(error);
    process.exitCode = 1;
  });
}

module.exports = { getDocumentsDirectory, validateEmail, releaseEmail };
