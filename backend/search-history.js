const { getFirestore, Timestamp, FieldPath } = require('firebase-admin/firestore');
const { getFirebaseAuth } = require('./auth');

const COLLECTION = 'searchHistory';
const PAGE_SIZE = 50;

function decodeCursor(value) {
  if (value === undefined || value === null) return null;
  try {
    if (typeof value !== 'string' || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(cursor.at) || cursor.at < 0 || cursor.at > 253402300799999
      || typeof cursor.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(cursor.id)) throw new Error();
    return cursor;
  } catch {
    throw Object.assign(new Error('Página de histórico inválida. Atualize a lista.'), { code: 'INVALID_INPUT' });
  }
}

function createHistoryStore({ enabled = process.env.SEARCH_HISTORY_ENABLED === 'true',
  getDb = () => getFirestore(getFirebaseAuth().app), now = () => Timestamp.now() } = {}) {
  return {
    enabled,
    async record({ uid, email, type, term }) {
      if (!enabled) return;
      // Apenas identidade validada e campos escolhidos pelo servidor são gravados.
      // Uma escrita por consulta, sem copiar resultados, tokens ou credenciais.
      await getDb().collection(COLLECTION).doc().create({ uid, email, type, term, at: now() });
    },
    async list(cursor) {
      if (!enabled) throw Object.assign(new Error('History disabled'), { code: 'HISTORY_DISABLED' });
      const position = decodeCursor(cursor);
      let query = getDb().collection(COLLECTION)
        .orderBy('at', 'desc').orderBy(FieldPath.documentId(), 'desc');
      if (position) query = query.startAfter(Timestamp.fromMillis(position.at), position.id);
      const snapshot = await query.limit(PAGE_SIZE + 1).get();
      const docs = snapshot.docs.slice(0, PAGE_SIZE);
      const items = docs.map(doc => {
        const row = doc.data();
        return { id: doc.id, uid: row.uid, email: row.email, type: row.type, term: row.term,
          at: row.at.toDate().toISOString() };
      });
      const last = docs.at(-1);
      const nextCursor = snapshot.docs.length > PAGE_SIZE && last
        ? Buffer.from(JSON.stringify({ at: last.data().at.toMillis(), id: last.id })).toString('base64url')
        : null;
      return { items, nextCursor };
    },
  };
}

module.exports = { createHistoryStore, decodeCursor };
