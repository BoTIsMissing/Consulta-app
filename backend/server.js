const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const { requireAuth } = require('./auth');
const runtimeConfig = require('./runtime-config.json');
const { getDatabaseConfig } = require('./database-config');

const app = express();
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : runtimeConfig.allowedOrigins;
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

const api = express.Router();
app.use('/api', requireAuth, api);
api.get('/auth/session', (req, res) => res.json({ email: req.user.email }));

async function handleDatabaseError(res, error) {
  console.error('Falha na consulta SQL.');
  await sql.close().catch(() => {});
  return res.status(error.code === 'SQL_CONFIGURATION_ERROR' ? 503 : 500)
    .json({ erro: 'Não foi possível consultar os dados. Tente novamente mais tarde.' });
}

async function buscarTodosPorId(pool, id) {
  // Cada consulta paralela precisa da sua própria Request.
  const consultar = (query) => pool.request()
    .input('id', sql.BigInt, String(id))
    .query(query);
  const [people, profile, address, email, fone, connected, credit, status] =
    await Promise.all([
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
    ]);
  return {
    people:    people.recordset,
    profile:   profile.recordset,
    address:   address.recordset,
    email:     email.recordset,
    fone:      fone.recordset,
    connected: connected.recordset,
    credit:    credit.recordset,
    status:    status.recordset,
  };
}

// Busca por nome — lista de candidatos
api.get('/buscar-nome', async (req, res) => {
  const { termo, parcial } = req.query;
  if (typeof termo !== 'string' || termo.trim().length < 2)
    return res.status(400).json({ erro: 'Digite ao menos 2 caracteres.' });
  const nome = termo.trim().replace(/\s+/g, ' ').toUpperCase();
  const buscaParcial = parcial === 'true';
  const partes = nome.split(' ').map(parte => parte.replace(/\.+$/, '')).filter(Boolean);
  if (buscaParcial && partes.join('').length < 2)
    return res.status(400).json({ erro: 'Digite ao menos 2 caracteres do nome.' });
  const parametro = buscaParcial
    ? `%${partes.map(parte => parte.replace(/[%_\[]/g, caractere => `[${caractere}]`)).join('%')}%`
    : nome;
  try {
    const pool = await sql.connect(await getDatabaseConfig());
    const result = await pool.request()
      .input('termo', sql.VarChar, parametro)
      .query(`SELECT TOP 50 id, cpf, name, birth_date, genre FROM people
        WHERE name ${buscaParcial ? 'LIKE' : '='} @termo COLLATE Latin1_General_CI_AI
        ORDER BY name, id`);
    await sql.close();
    res.json({ total: result.recordset.length, candidatos: result.recordset });
  } catch (err) {
    await handleDatabaseError(res, err);
  }
});

// Busca por CPF
api.get('/buscar-cpf', async (req, res) => {
  const { termo } = req.query;
  if (typeof termo !== 'string') return res.status(400).json({ erro: 'CPF inválido.' });
  const cpf = termo.replace(/[.\-\s]/g, '');
  if (!/^\d+$/.test(cpf)) return res.status(400).json({ erro: 'CPF inválido.' });
  try {
    const pool = await sql.connect(await getDatabaseConfig());
    const idResult = await pool.request()
      .input('cpf', sql.VarChar, cpf)
      .query('SELECT id FROM people WHERE cpf = @cpf');
    if (idResult.recordset.length === 0) {
      await sql.close();
      return res.json({ encontrado: false, dados: null });
    }
    const dados = await buscarTodosPorId(pool, idResult.recordset[0].id);
    await sql.close();
    res.json({ encontrado: true, dados });
  } catch (err) {
    await handleDatabaseError(res, err);
  }
});

// Busca por ID
api.get('/buscar-id', async (req, res) => {
  const { id } = req.query;
  if (typeof id !== 'string' || !/^[0-9]+$/.test(id) || BigInt(id) > 9223372036854775807n)
    return res.status(400).json({ erro: 'ID inválido.' });
  try {
    const pool = await sql.connect(await getDatabaseConfig());
    const dados = await buscarTodosPorId(pool, id);
    await sql.close();
    const encontrado = dados.people.length > 0;
    res.json({ encontrado, dados: encontrado ? dados : null });
  } catch (err) {
    await handleDatabaseError(res, err);
  }
});

// Busca por endereço
api.get('/buscar-endereco', async (req, res) => {
  const { termo } = req.query;
  if (!termo || termo.trim().length < 2)
    return res.status(400).json({ erro: 'Digite ao menos 2 caracteres.' });
  try {
    const pool = await sql.connect(await getDatabaseConfig());
    const result = await pool.request()
      .input('termo', sql.VarChar, `%${termo.trim().toUpperCase()}%`)
      .query(`
        SELECT TOP 50 a.id, a.logradouro, a.numero, a.complemento,
               a.bairro, a.cidade, a.uf, a.cep, a.latitude, a.longitude,
               p.name, p.cpf
        FROM p_address a
        JOIN people p ON p.id = a.id
        WHERE a.logradouro LIKE @termo COLLATE Latin1_General_CI_AI
           OR a.bairro     LIKE @termo COLLATE Latin1_General_CI_AI
           OR a.cidade     LIKE @termo COLLATE Latin1_General_CI_AI
           OR a.cep = @termo
      `);
    await sql.close();
    res.json({ total: result.recordset.length, enderecos: result.recordset });
  } catch (err) {
    await handleDatabaseError(res, err);
  }
});

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

app.get('/', (req, res) => res.json({ service: 'Consulta BR API', status: 'ok' }));
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

if (require.main === module) {
  const port = process.env.PORT || runtimeConfig.port;
  app.listen(port, '0.0.0.0', () => console.log(`Servidor rodando na porta ${port}`));
}

module.exports = app;
