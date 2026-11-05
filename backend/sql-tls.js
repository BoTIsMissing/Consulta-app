const path = require('node:path');
const { readFile } = require('node:fs/promises');
const { X509Certificate } = require('node:crypto');

async function getSqlTlsOptions({ caFile = '', serverName = '', trustServerCertificate = false,
  readCertificate = filename => readFile(filename, 'utf8') } = {}) {
  const trust = typeof trustServerCertificate === 'string'
    ? trustServerCertificate.trim().toLowerCase() : trustServerCertificate;
  if (![true, false, 'true', 'false'].includes(trust)) {
    throw Object.assign(new Error('Invalid SQL trust setting'), { reason: 'INVALID_TLS_SETTINGS' });
  }
  const options = { encrypt: true, trustServerCertificate: trust === true || trust === 'true' };
  if (typeof caFile !== 'string' || typeof serverName !== 'string'
    || serverName.length > 253 || /[\s\0]/.test(serverName.trim())) {
    throw Object.assign(new Error('Invalid SQL TLS settings'), { reason: 'INVALID_TLS_SETTINGS' });
  }
  // Esta exceção só é ativada pela configuração explícita do administrador.
  if (options.trustServerCertificate) return options;
  if (serverName.trim()) options.serverName = serverName.trim();
  if (!caFile.trim()) return options;

  let pem;
  try {
    pem = await readCertificate(path.resolve(__dirname, caFile));
  } catch (cause) {
    const reason = cause.code === 'ENOENT' ? 'CA_FILE_NOT_FOUND' : 'CA_FILE_UNREADABLE';
    throw Object.assign(new Error('Cannot read SQL CA certificate'), { reason });
  }
  const certificates = typeof pem === 'string'
    ? pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) : null;
  try {
    if (!certificates?.length || /-----BEGIN [^-]*PRIVATE KEY-----/.test(pem)) throw new Error();
    for (const certificate of certificates) new X509Certificate(certificate);
  } catch {
    throw Object.assign(new Error('Invalid SQL CA certificate'), { reason: 'INVALID_CA_CERTIFICATE' });
  }
  // A confiança adicional vale somente para a conexão SQL.
  options.cryptoCredentialsDetails = { ca: certificates };
  return options;
}

module.exports = { getSqlTlsOptions };
