const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const { requireAuth } = require('./auth');
const runtimeConfig = require('./runtime-config.json');
const { getDatabasePool, closeDatabasePool } = require('./database-pool');
const { securityHeaders, noStore, createRequestLimits, createQueryGate } = require('./security');
const { bodyFields, searchText, cpfText, plateText, personId, escapeLike, nameSearch } = require('./input-validation');
const { vehicleQuery } = require('./vehicle-query');
const { logSqlError } = require('./sql-diagnostics');

function createApp({ authenticate = requireAuth, getPool = getDatabasePool,
  origins, rateLimits, queryLimits, trustProxy = process.env.RENDER === 'true' ? 1 : false } = {}) {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.set('query parser', 'simple');
  app.use(securityHeaders());
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
  const allowedOrigins = origins || (process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : runtimeConfig.allowedOrigins);
  const limits = createRequestLimits(rateLimits);
  const guardQuery = createQueryGate(queryLimits);
  const api = express.Router();
  api.use(noStore);
  api.use((req, res, next) => {
    if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) {
      return res.status(403).json({ erro: 'Origem não permitida.' });
    }
    next();
  });
  api.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'], maxAge: 600 }));
  api.use(limits.beforeAuth);
  api.use(authenticate);
  api.use(limits.afterAuth);
  api.get('/auth/session', (req, res) => res.json({ email: req.user.email }));
  api.use((req, res, next) => {
    if (req.path.startsWith('/buscar-') && req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ erro: 'Esta versão do site precisa ser atualizada. Recarregue a página.' });
    }
    if (req.method === 'POST' && !req.is('application/json')) {
      return res.status(415).json({ erro: 'Envie a solicitação como JSON.' });
    }
    if (Object.keys(req.query).length) return res.status(400).json({ erro: 'Envie os campos no corpo JSON da solicitação.' });
    next();
  });
  api.use(express.json({ limit: '4kb', strict: true, inflate: false }));
  app.use('/api', api);

  async function handleDatabaseError(res, error) {
    if (error.code === 'INVALID_INPUT') return res.status(400).json({ erro: error.message });
    logSqlError(error);
    return res.status(error.code === 'SQL_CONFIGURATION_ERROR' ? 503 : 500)
      .json({ erro: 'Não foi possível consultar os dados. Tente novamente mais tarde.' });
  }

  async function buscarTodosPorId(pool, id) {
    // Cada consulta paralela precisa da sua própria Request.
    const consultar = (query) => pool.request()
      .input('id', sql.BigInt, String(id))
      .query(query);
    const sections = await Promise.allSettled([
        consultar('SELECT * FROM people      WHERE id = @id'),
        consultar('SELECT * FROM p_profile   WHERE id = @id'),
        consultar('SELECT * FROM p_address   WHERE id = @id'),
        consultar('SELECT * FROM p_email     WHERE id = @id'),
        consultar('SELECT * FROM p_fone      WHERE id = @id'),
        consultar(`
          SELECT DISTINCT c.name, c.name_relative, c.relative, p.id, pd.cpf, py.birth_date
          FROM BR..p_connected c
          INNER JOIN BR..people p ON p.name = c.name_relative
          LEFT JOIN BR..people_doc pd ON pd.id = p.id
          LEFT JOIN BR..people_year py ON py.id = p.id
          WHERE c.id = @id
        `),
        consultar('SELECT * FROM p_credit    WHERE id = @id'),
        consultar('SELECT * FROM p_status    WHERE id = @id'),
        consultar(`SELECT cnpj, cnpj_relacionamento, dt_inicio, dt_carencia, descricao_profissao
          FROM BR..p_pep WHERE id = @id`),
      ]);
    const failed = sections.find(section => section.status === 'rejected');
    if (failed) throw failed.reason;
    const [people, profile, address, email, fone, connected, credit, status, pep] = sections.map(section => section.value);
    return {
      people:    people.recordset,
      profile:   profile.recordset,
      address:   address.recordset,
      email:     email.recordset,
      fone:      fone.recordset,
      connected: connected.recordset,
      credit:    credit.recordset,
      status:    status.recordset,
      pep:       pep.recordset,
    };
  }

  // Busca por nome — lista de candidatos
  api.post('/buscar-nome', guardQuery(async (req, res) => {
    try {
      const { termo, parcial = false } = bodyFields(req.body, ['termo', 'parcial']);
      const parametro = nameSearch(termo, parcial);
      const buscaParcial = parcial;
      const pool = await getPool();
      const result = await pool.request()
        .input('termo', sql.VarChar, parametro)
        .query(`SELECT TOP 50 CONVERT(varchar(20), id) AS id, cpf, name, birth_date, genre FROM people
          WHERE name ${buscaParcial ? 'LIKE' : '='} @termo COLLATE Latin1_General_CI_AI
          ORDER BY name, id`);
      res.json({ total: result.recordset.length, candidatos: result.recordset });
    } catch (err) {
      await handleDatabaseError(res, err);
    }
  }));

  // Busca por CPF
  api.post('/buscar-cpf', guardQuery(async (req, res) => {
    try {
      const { termo } = bodyFields(req.body, ['termo']);
      const cpf = cpfText(termo);
      const pool = await getPool();
      const idResult = await pool.request()
        .input('cpf', sql.VarChar, cpf)
        .query('SELECT CONVERT(varchar(20), id) AS id FROM people WHERE cpf = @cpf');
      if (idResult.recordset.length === 0) {
        return res.json({ encontrado: false, dados: null });
      }
      const dados = await buscarTodosPorId(pool, idResult.recordset[0].id);
      res.json({ encontrado: true, dados });
    } catch (err) {
      await handleDatabaseError(res, err);
    }
  }));

  // Busca exata por placa, incluindo o formato antigo com hífen.
  api.post('/buscar-placa', guardQuery(async (req, res) => {
    try {
      const plate = plateText(bodyFields(req.body, ['termo']).termo);
      const pool = await getPool();
      const result = await pool.request()
        .input('plate', sql.VarChar(50), plate)
        .input('formattedPlate', sql.VarChar(50), `${plate.slice(0, 3)}-${plate.slice(3)}`)
        .query(vehicleQuery);
      res.json({ total: result.recordset.length, veiculos: result.recordset });
    } catch (err) {
      await handleDatabaseError(res, err);
    }
  }));

  // Busca por ID
  api.post('/buscar-id', guardQuery(async (req, res) => {
    try {
      const id = personId(bodyFields(req.body, ['id']).id);
      const pool = await getPool();
      const dados = await buscarTodosPorId(pool, id);
      const encontrado = dados.people.length > 0;
      res.json({ encontrado, dados: encontrado ? dados : null });
    } catch (err) {
      await handleDatabaseError(res, err);
    }
  }));

  // Busca por endereço
  api.post('/buscar-endereco', guardQuery(async (req, res) => {
    try {
      const termo = searchText(bodyFields(req.body, ['termo']).termo, 200);
      const pool = await getPool();
      const result = await pool.request()
        .input('termo', sql.VarChar, `%${escapeLike(termo.toUpperCase())}%`)
        .query(`
          SELECT TOP 50 CONVERT(varchar(20), a.id) AS id, a.logradouro, a.numero, a.complemento,
                 a.bairro, a.cidade, a.uf, a.cep, a.latitude, a.longitude,
                 p.name, p.cpf
          FROM p_address a
          JOIN people p ON p.id = a.id
          WHERE a.logradouro LIKE @termo COLLATE Latin1_General_CI_AI
             OR a.bairro     LIKE @termo COLLATE Latin1_General_CI_AI
             OR a.cidade     LIKE @termo COLLATE Latin1_General_CI_AI
             OR a.cep = @termo
        `);
      res.json({ total: result.recordset.length, enderecos: result.recordset });
    } catch (err) {
      await handleDatabaseError(res, err);
    }
  }));

  app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  app.get('/', (req, res) => res.json({ service: 'Consulta BR API', status: 'ok' }));
  app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  app.use((error, req, res, next) => {
    if (res.headersSent) return res.end();
    const status = error.type === 'entity.too.large' ? 413
      : error.type === 'encoding.unsupported' ? 415 : error.type === 'entity.parse.failed' ? 400 : 500;
    return res.status(status).json({ erro: status === 413 ? 'Solicitação muito grande.'
      : status === 500 ? 'Não foi possível processar a solicitação.' : 'Solicitação inválida.' });
  });
  return app;
}

const app = createApp();
if (require.main === module) {
  const port = process.env.PORT || runtimeConfig.port;
  const server = app.listen(port, '0.0.0.0', () => console.log(`Servidor rodando na porta ${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    server.close(async () => { await closeDatabasePool(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
module.exports = app;
module.exports.createApp = createApp;
