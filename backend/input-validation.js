function invalid(message) {
  const error = new Error(message);
  error.code = 'INVALID_INPUT';
  throw error;
}

function bodyFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !fields.includes(key))) {
    invalid('Formato de solicitação inválido.');
  }
  return value;
}

function searchText(value, maxLength = 150) {
  if (typeof value !== 'string' || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    invalid(`Digite um texto com 2 a ${maxLength} caracteres.`);
  }
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length < 2) invalid('Digite ao menos 2 caracteres.');
  return text;
}

function cpfText(value) {
  if (typeof value !== 'string' || value.length > 32) invalid('CPF inválido.');
  const cpf = value.replace(/[.\-\s]/g, '');
  if (!/^\d{11}$/.test(cpf)) invalid('Digite um CPF com 11 dígitos.');
  return cpf;
}

function cnpjText(value) {
  if (typeof value !== 'string' || value.length > 32) invalid('CNPJ inválido.');
  const cnpj = value.replace(/[.\/\-\s]/g, '');
  if (!/^\d{14}$/.test(cnpj)) invalid('Digite um CNPJ com 14 dígitos.');
  return cnpj;
}

function plateText(value) {
  if (typeof value !== 'string' || value.length > 16) invalid('Placa inválida.');
  const plate = value.trim().toUpperCase();
  if (!/^[A-Z]{3}-?(?:\d{4}|\d[A-Z]\d{2})$/.test(plate)) {
    invalid('Digite uma placa válida, como ABC-1234 ou ABC1D23.');
  }
  return plate.replace('-', '');
}

function personId(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) invalid('ID inválido.');
    value = String(value);
  }
  if (typeof value !== 'string' || !/^\d{1,19}$/.test(value)
    || BigInt(value) > 9223372036854775807n) invalid('ID inválido.');
  return value;
}

function escapeLike(value) {
  return value.replace(/[%_\[]/g, character => `[${character}]`);
}

function nameSearch(value, partial = false) {
  if (typeof partial !== 'boolean') invalid('Opção de busca inválida.');
  const name = searchText(value).toUpperCase();
  if (!partial) return name;
  const parts = name.split(' ').map(part => part.replace(/\.+$/, '')).filter(Boolean);
  if (parts.join('').length < 2) invalid('Digite ao menos 2 caracteres do nome.');
  return `%${parts.map(escapeLike).join('%')}%`;
}

module.exports = { bodyFields, searchText, cpfText, cnpjText, plateText, personId, escapeLike, nameSearch };
