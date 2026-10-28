# Consulta BR — Angular + Node.js

Sistema de consulta de pessoas por nome ou CPF no SQL Server.

---

## Pré-requisitos

- [Node.js](https://nodejs.org) instalado
- [Angular CLI](https://angular.io/cli): `npm install -g @angular/cli`
- Acesso ao servidor SQL Server

---

## Configuração

### 1. Backend

Edite `backend/server.js` e ajuste as credenciais:

```js
const config = {
  server: '189.1.174.51',
  user: 'seu_usuario',      // ← altere aqui
  password: 'sua_senha',    // ← altere aqui
  ...
};
```

Instale as dependências e rode:

```bash
cd backend
npm install
node server.js
```

### 2. Frontend Angular

Na raiz do projeto:

```bash
npm install
ng serve
```

Acesse: http://localhost:4200

---

## Estrutura

```
consulta-app/
├── backend/
│   ├── server.js          ← API Node.js + Express
│   └── package.json
└── src/app/
    ├── services/
    │   └── consulta.service.ts
    └── components/busca/
        ├── busca.component.ts
        ├── busca.component.html
        └── busca.component.css
```

---

## Como usar

1. Roda o backend (`node server.js`)
2. Roda o Angular (`ng serve`)
3. Acessa `http://localhost:4200`
4. Seleciona o banco na barra lateral
5. Digita nome ou CPF e pressiona Enter
