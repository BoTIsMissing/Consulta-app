const { getFirestore, Timestamp, FieldPath } = require('firebase-admin/firestore');
const { getFirebaseAuth } = require('./auth');

async function checkHistory() {
  const db = getFirestore(getFirebaseAuth().app);
  const ref = db.collection('searchHistory').doc();
  let created = false;
  try {
    await ref.create({ uid: 'system-check', email: '', type: 'config_check', term: 'TESTE DE CONFIGURAÇÃO', at: Timestamp.now() });
    created = true;
    if (!(await ref.get()).exists) throw new Error('History check failed');
    await db.collection('searchHistory').orderBy('at', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(1).get();
  } finally {
    if (created) await ref.delete();
  }
}

if (require.main === module) {
  checkHistory().then(() => console.log('Firestore verificado: gravação, leitura, paginação e remoção do registro de teste concluídas.'))
    .catch(() => { console.error('Não foi possível verificar o Firestore. Confira se o banco (default) existe, a API está ativa e a conta de serviço tem acesso ao Firestore.'); process.exitCode = 1; });
}
module.exports = { checkHistory };
