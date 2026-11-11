# Consulta BR

Angular no GitHub Pages, API Node/Express no Render, login por e-mail/senha do Firebase e dados no SQL Server. O backend valida o token e a permissão `panelAccess` antes de consultar o banco.

## Consulta por placa

Selecione **Placa** no painel. São aceitas placas antigas (`ABC-1234` ou `ABC1234`) e Mercosul (`ABC1D23`), inclusive em minúsculas. A consulta é exata e retorna até 50 registros, com os detalhes disponíveis do veículo e a descrição de nacionalidade. Não há associação com proprietário ou classificação de grupo sem um relacionamento confirmado no banco.

A API usa `POST /api/buscar-placa` com JSON `{ "termo": "ABC1D23" }`, exigindo a mesma conta Firebase liberada das consultas de pessoas. O usuário SQL do backend precisa de leitura em `BR_VEICULOS..br_vehicles_details` e `BR_VEICULOS..nacionalidade`. Não há novas credenciais nem variáveis de ambiente. Publique o backend no Render antes do frontend no GitHub Pages.

Sem índice em `plate`, a consulta pode demorar mesmo com o limite de resultados. Nenhum índice ou dado do banco é alterado pela aplicação. O RG não será incluído, pois não existe no banco, conforme confirmado pelo administrador.

## Registros PEP / CNPJ

Selecione **CNPJ** no menu para localizar pessoas com registros correspondentes em `cnpj` ou `cnpj_relacionamento` de `p_pep`. Aceita os 14 dígitos com ou sem máscara. A API autenticada `POST /api/buscar-cnpj`, com JSON `{ "termo": "00123456000100" }`, retorna até 50 pessoas sem duplicá-las quando há vários registros correspondentes. Uma pessoa é aberta diretamente; com várias, escolha na lista. A pesquisa não consulta um cadastro completo de empresas.

As consultas de pessoas também retornam os registros de `BR..p_pep`, filtrados pelo `id` da pessoa. A seção mostra `cnpj`, `cnpj_relacionamento`, `dt_inicio`, `dt_carencia` e `descricao_profissao` quando preenchidos. CNPJs numéricos com 14 dígitos recebem máscara visual, preservando zeros iniciais; outros valores permanecem como vieram do banco. Esses registros não comprovam propriedade ou participação societária. O backend precisa de permissão de leitura nessa tabela.

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

Se o SQL usa certificado autoassinado ou emitido por uma autoridade privada, obtenha o certificado público PEM correto do administrador do banco e confirme sua identidade por um canal confiável. No Render, cadastre esse certificado ou a cadeia de autoridades certificadoras como Secret File `sql-ca.pem`, sem chave privada. Configure `SQL_CA_FILE=/etc/secrets/sql-ca.pem` e faça um novo deploy. A confiança adicional é aplicada somente ao SQL; a validação de certificados permanece ativada.

Se a conexão é feita por IP, mas o certificado foi emitido para um nome DNS, configure também `SQL_TLS_SERVER_NAME` com o nome exato presente no certificado e confirmado pelo administrador do banco. Esse nome será validado pelo TLS; ele não altera o IP de conexão. Localmente, os campos opcionais `sql.caFile` e `sql.tlsServerName` em `runtime-config.json` oferecem a mesma configuração. O certificado deve estar válido, e as respectivas autoridades devem ser confiáveis. Apenas obter qualquer certificado pela rede e confiar nele sem confirmação não autentica o servidor correto.

Para servidores com certificado autoassinado quando você não dispõe do certificado público confiável, há uma opção de compatibilidade explícita: `SQL_TRUST_SERVER_CERTIFICATE=true` nas Environment Variables do backend no Render. A conexão continua usando TLS (`encrypt: true`), mas deixa de validar a identidade do servidor, aumentando o risco de interceptação por um servidor impostor. Essa opção vem desativada por padrão, vale somente para o SQL e dispensa `SQL_CA_FILE` enquanto estiver ativa. O backend registra `[SQL_TLS_UNVERIFIED]` nesse modo. Para voltar à validação, remova a variável ou defina `false` e configure um certificado confiável quando necessário. Essa opção não oferece a mesma proteção de um certificado validado.

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

No Windows, você pode liberar usuários sem digitar comandos: salve o JSON privado do Firebase como **fr-base.json** na sua pasta **Documentos** e dê dois cliques em **liberar-acesso.bat**, na raiz deste projeto. Digite o e-mail e pressione Enter. O programa usa a pasta Documentos real do Windows, inclusive quando redirecionada ao OneDrive, e mostra se a liberação foi concluída. Node.js e as dependências do backend precisam estar instalados. O arquivo privado nunca é exibido ou enviado ao GitHub.

Esse atalho usa `fr-base.json` somente no computador do administrador. O Secret File no Render continua com o nome `service-account.json`; não é necessário alterá-lo. Após a liberação, o usuário deve sair da conta no site e entrar novamente.

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

As rotas de busca agora recebem **POST com corpo JSON** (`termo`, `parcial` ou `id`), para evitar identificadores pessoais nas URLs. O frontend e a API precisam ser publicados juntos; versões antigas do frontend que usam GET recebem 405 e devem ser atualizadas no navegador após o deploy. A consulta de sessão continua sendo GET em `/api/auth/session`.

A API limita chamadas a 120/minuto por IP e 30/minuto por conta autorizada, com no máximo duas consultas simultâneas por conta e cinco no total por processo. Excesso retorna 429. O pool SQL tem no máximo cinco conexões e é compartilhado sem fechamento a cada requisição. Corpos JSON têm limite de 4 KB; nomes, endereços, CPFs e IDs são validados antes do acesso ao banco. Os limites em memória valem por processo e reiniciam com o serviço; não substituem proteção de borda contra ataques distribuídos.

O build de produção publica uma política CSP e uma política de referência restritas. O workflow também executa os testes da API e a verificação de arquivos de credenciais antes da publicação. Execute `npm.cmd run check:secrets` e `npm.cmd run test:security` na raiz para validar essa proteção localmente. A configuração pública Firebase é permitida; arquivos de credenciais e chaves privadas detectadas são bloqueados.

Na pasta `backend`, execute `npm.cmd test`. Para verificar as credenciais configuradas e executar somente `SELECT 1` no banco, use `npm.cmd run check:sql`. Esse teste não consulta dados pessoais nem imprime senhas.

`GET /healthz` verifica somente se o processo HTTP está funcionando; ele não confirma Firebase ou conexão SQL. A validação real do login e do banco depende dos arquivos secretos, das permissões e do acesso de rede no ambiente de publicação.
