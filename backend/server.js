require('dotenv').config();

const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

const config = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
    charset: 'utf8',
  },
  requestTimeout: 60000,
  connectionTimeout: 30000,
};

// Bancos disponíveis para busca
const BANCOS = ['BR_SAUDE', 'BR_PEP', 'BR_END'];

app.get('/buscar', async (req, res) => {
  const { termo, banco } = req.query;

  if (!termo || termo.trim().length < 2) {
    return res.status(400).json({ erro: 'Digite ao menos 2 caracteres.' });
  }

  const bancoAlvo = banco || 'BR_SAUDE';

  try {
    const pool = await sql.connect({ ...config, database: bancoAlvo });

    // Detecta se é CPF (só números) ou nome
    const isCpf = /^\d+$/.test(termo.trim());

    if (isCpf) {
    result = await pool.request()
      .input('cpf', sql.VarChar, termo.trim())
      .query('SELECT TOP 100 * FROM people_perfil WHERE cpf = @cpf');
  } else {
    result = await pool.request()
      .input('nome', sql.VarChar, termo.trim())
      .query('SELECT TOP 100 * FROM people_perfil WHERE nome = @nome COLLATE Latin1_General_CI_AI');
  }

    await sql.close();
    res.json({ total: result.recordset.length, dados: result.recordset });
  } catch (err) {
    console.error('ERRO:', err.message);
    await sql.close().catch(() => {});
    res.status(500).json({ erro: err.message });
  }
});

app.get('/bancos', (req, res) => {
  res.json(BANCOS);
});

app.listen(3000, () => {
  console.log('✅ Servidor rodando em http://localhost:3000');
});
