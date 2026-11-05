const sql = require('mssql');
const { getDatabaseConfig } = require('./database-config');
const { logSqlError } = require('./sql-diagnostics');

async function checkSqlConnection() {
  const config = await getDatabaseConfig();
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    await pool.request().query('SELECT 1 AS ok');
  } finally {
    await pool.close().catch(() => {});
  }
}

if (require.main === module) {
  checkSqlConnection().then(() => {
    console.log('Arquivo secreto e conexão SQL verificados. Nenhum dado pessoal foi consultado.');
  }).catch(error => {
    logSqlError(error);
    process.exitCode = 1;
  });
}

module.exports = { checkSqlConnection };
