import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const privateKey = /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----(?:\r?\n|\\n)[A-Za-z0-9+/=\\\r\n]{64,}-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/;
const forbiddenName = /(?:^|\/)(?:fr-base\.json|[^/]*service-account[^/]*\.json|[^/]*firebase-adminsdk[^/]*\.json|[^/]*sql-credentials[^/]*\.json|[^/]+\.(?:key|p12|pfx)|\.env(?:\..+)?)$/i;
const findings = [];
for (const file of files) {
  if (!existsSync(file)) continue;
  const contents = readFileSync(file, 'utf8');
  if ((forbiddenName.test(file) && !/(?:^|\/)\.env\.example$/.test(file)) || privateKey.test(contents)
    || (/"type"\s*:\s*"service_account"/.test(contents) && /"private_key"\s*:/.test(contents))) {
    findings.push(file);
  }
}
if (findings.length) {
  console.error('Publicação bloqueada: possíveis credenciais em arquivos rastreados:');
  for (const file of findings) console.error(`- ${file}`);
  process.exitCode = 1;
} else {
  console.log('Nenhum arquivo de credencial ou chave privada detectado nos arquivos rastreados.');
}
