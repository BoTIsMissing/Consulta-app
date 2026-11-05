# Consulta BR

Angular no GitHub Pages, API Node/Express no Render, login por e-mail/senha do Firebase e dados no SQL Server. O backend valida o token e a permissão `panelAccess` antes de consultar o banco.

## Publicar o backend no Render

Crie um **Web Service** conectado ao repositório GitHub com:

| Campo | Valor |
| --- | --- |
| Runtime | Node |
| Root Directory | `backend` |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |

O arquivo `render.yaml` na raiz também permite criar o serviço usando **New → Blueprint**. Ele seleciona o plano gratuito, que suspende o serviço após períodos sem tráfego e pode causar demora no primeiro acesso. Escolha outro plano no Render se precisar de disponibilidade contínua. A publicação não foi executada por esta alteração.

Em **Environment**, configure estas variáveis do serviço. São configurações do Render; o projeto não carrega arquivo `.env`:

```text
NODE_ENV=production
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/service-account.json
SQL_CREDENTIALS_FILE=/etc/secrets/sql-credentials.json
ALLOWED_ORIGINS=https://SEU_USUARIO.github.io
```

`ALLOWED_ORIGINS` contém a origem, sem o caminho do repositório. Para mais de uma origem, separe com vírgula. A porta é fornecida pelo Render na variável `PORT`; o backend escuta em `0.0.0.0`.

Referências: [Node/Express no Render](https://render.com/docs/deploy-node-express-app), [Blueprints](https://render.com/docs/blueprint-spec) e [plano gratuito](https://render.com/docs/free).

## Arquivos secretos no Render

No serviço do backend, abra **Environment → Secret Files → Add Secret File** e cadastre:

| Filename | Conteúdo |
| --- | --- |
| `service-account.json` | JSON privado de uma conta de serviço do seu projeto Firebase. |
| `sql-credentials.json` | JSON abaixo, com o usuário e a senha reais do SQL. |

```json
{
  "user": "seu_usuario_sql",
  "password": "sua_senha_sql"
}
```

Cadastre os conteúdos diretamente no painel do Render. Os arquivos ficam disponíveis ao backend em `/etc/secrets/<filename>`. Nunca inclua esses arquivos no frontend ou nos arquivos publicados no Pages. O `.gitignore` protege os nomes indicados no diretório `backend` e a pasta `backend/private`.

Use uma chave Firebase nova se a anterior tiver sido compartilhada. A conta de serviço precisa das permissões Firebase para validar usuários e, no ambiente do administrador, para liberar contas. O Google Secret Manager e o Cloud Run não são necessários para esta configuração.

Ao atualizar um arquivo secreto, faça o novo deploy do serviço para carregar as credenciais. A API mantém a configuração SQL apenas em memória e não retorna mensagens internas que possam revelar dados de conexão. Se o arquivo secreto faltar ou estiver inválido, as consultas falham; não há leitura das credenciais antigas do `.env`.

Referência: [Secret Files do Render](https://render.com/docs/configure-environment-variables#secret-files).

## IP, rede e certificado SQL

O IP do SQL está em `sql.server` no arquivo `backend/runtime-config.json`. Esse arquivo contém apenas configurações do servidor, porta, banco, projeto Firebase e caminhos opcionais de arquivos privados. Ele não deve conter usuários, senhas ou chaves privadas.

No Render, abra **Connect → Outbound** para consultar os endereços/faixas de saída do serviço e configure o firewall do SQL para aceitar o tráfego necessário. Não use os IPs do domínio do GitHub Pages como origem da conexão SQL: quem conecta é a API no Render.

O endereço de saída pode pertencer a uma faixa compartilhada com outros serviços. As credenciais SQL continuam obrigatórias. Se precisar de endereços exclusivos, verifique a opção de IPs dedicados do Render.

A conexão usa TLS com validação do certificado (`encrypt: true`, `trustServerCertificate: false`). O SQL Server deve apresentar certificado confiável e válido para o endereço configurado; se necessário, utilize o nome DNS que corresponde ao certificado. Use uma conta SQL com as permissões de leitura necessárias ao aplicativo.

Referência: [endereços de saída do Render](https://render.com/docs/outbound-ip-addresses).

## Frontend no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` publica o Angular a cada push na branch `main`, incluindo somente os arquivos compilados do frontend. No repositório GitHub, abra **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions** antes de executar a publicação. Após enviar o workflow ao GitHub, acompanhe a execução na aba **Actions**; também é possível executá-lo manualmente pelo botão **Run workflow**.

O endereço esperado para este repositório é https://botismissing.github.io/Consulta-app/. O workflow utiliza o caminho base `/Consulta-app/`; ajuste-o se renomear o repositório ou configurar um domínio próprio. O endereço do Render é o backend; a tela de login fica no Pages.

1. No Firebase, registre um aplicativo Web do projeto `consulta-app-1df95`.
2. Preencha `apiKey`, `authDomain`, `projectId` e `appId` em `src/app/config.ts` com a configuração pública desse aplicativo.
3. Depois de criar o serviço no Render, altere `apiUrl` no mesmo arquivo para a URL HTTPS real da API, incluindo `/api`, por exemplo `https://consulta-api.onrender.com/api`. A URL do exemplo deve ser substituída pela URL gerada para seu serviço.
4. Em **Firebase Authentication → Settings → Authorized domains**, adicione `SEU_USUARIO.github.io` e `localhost` para desenvolvimento.
5. Compile o Angular e publique somente os arquivos de `dist/consulta-app-new/browser` no Pages.

Para um site Pages no caminho `/NOME_DO_REPOSITORIO/`, compile na raiz com:

```powershell
npm.cmd run build -- --base-href /NOME_DO_REPOSITORIO/
```

Para domínio próprio ou site na raiz, use o `base-href` correspondente. A configuração pública Firebase pode estar no frontend; o JSON privado e as credenciais SQL pertencem somente ao backend.

## Criar e liberar usuários

1. No Firebase, ative **Authentication → Sign-in method → E-mail/senha**.
2. Em **Authentication → Users → Add user**, cadastre o e-mail e a senha.
3. Em um ambiente administrativo com acesso às credenciais Firebase, na pasta `backend`, execute:

```powershell
npm.cmd run authorize -- usuario@exemplo.com
```

Esse comando adiciona `panelAccess: true` à conta existente. Depois disso, o usuário entra no painel com e-mail e senha. Se já estava conectado, deve sair e entrar novamente. Para bloquear o acesso, desative ou exclua a conta no Firebase. A aplicação não oferece cadastro público e a API exige a liberação administrativa em cada consulta.

O comando pode ser executado em um computador administrativo configurado conforme a seção seguinte. O plano gratuito do Render não oferece shell interativo.

## Desenvolvimento local sem .env

Mantenha as credenciais fora do Git, por exemplo em `backend/private/service-account.json` e `backend/private/sql-credentials.json`. Em `backend/runtime-config.json`, configure:

- `googleCredentialsFile`: `private/service-account.json`.
- `sql.credentialsFile`: `private/sql-credentials.json`.

Não configure esses caminhos locais no deploy do Render: as variáveis indicadas anteriormente apontam para os arquivos secretos e têm prioridade. Como alternativa local, defina somente os caminhos via PowerShell:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:/credenciais/service-account.json'
$env:SQL_CREDENTIALS_FILE = 'C:/credenciais/sql-credentials.json'
```

O `.env` antigo foi preservado para permitir copiar os dados ao Render; ele não é usado pela aplicação. Após confirmar a migração, remova as credenciais antigas desse arquivo.

Na raiz, execute `npm.cmd install` e `npm.cmd start`. Em outro terminal, na pasta `backend`, execute `npm.cmd install` e `npm.cmd start`. Para desenvolvimento com o proxy local, `apiUrl` em `src/app/config.ts` deve ser `/api`. Acesse http://localhost:4200.

## Verificação

Na pasta `backend`, execute `npm.cmd test`. Para verificar as credenciais configuradas e executar somente `SELECT 1` no banco, use `npm.cmd run check:sql`. Esse teste não consulta dados pessoais nem imprime senhas.

`GET /healthz` verifica somente se o processo HTTP está funcionando; ele não confirma Firebase ou conexão SQL. A validação real do login e do banco depende dos arquivos secretos, das permissões e do acesso de rede no ambiente de publicação.
