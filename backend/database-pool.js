const sql = require('mssql');
const { getDatabaseConfig } = require('./database-config');

function createPoolManager({ loadConfig = getDatabaseConfig, Pool = sql.ConnectionPool } = {}) {
  let pending;
  return {
    getPool() {
      if (!pending) {
        pending = Promise.resolve().then(async () => {
          const config = await loadConfig();
          const pool = new Pool({ ...config, pool: { max: 5, min: 0, idleTimeoutMillis: 30000, acquireTimeoutMillis: 30000 } });
          pool.on('error', () => console.error('[SQL_POOL_ERROR] Falha em uma conexão do pool SQL.'));
          try {
            await pool.connect();
            return pool;
          } catch (error) {
            await pool.close().catch(() => {});
            throw error;
          }
        }).catch(error => { pending = undefined; throw error; });
      }
      return pending;
    },
    async close() {
      const current = pending;
      pending = undefined;
      if (current) await current.then(pool => pool.close()).catch(() => {});
    },
  };
}

const manager = createPoolManager();
module.exports = { createPoolManager, getDatabasePool: () => manager.getPool(), closeDatabasePool: () => manager.close() };
