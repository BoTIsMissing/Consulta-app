# Revisão de segurança — 2026-11-05

Escopo: código Angular, API Express, validação Firebase, conexão SQL, dependências e workflow GitHub Pages. Foram usados testes locais com banco simulado e verificações HTTP sem autenticação; nenhum registro pessoal do SQL foi consultado. As alterações desta revisão ainda precisam de commit, push e publicação para proteger a versão hospedada.

## Problemas corrigidos

| Problema | Correção |
| --- | --- |
| API sem limites de frequência ou concorrência | Limites por IP e por UID verificado; até duas consultas simultâneas por conta e cinco por processo. |
| Entrada de tamanho ilimitado e tipos inesperados | JSON limitado a 4 KB, tipos e campos validados, limites para nomes e endereços, CPF de 11 dígitos e ID compatível com BigInt do SQL. |
| Curingas de endereço permitiam buscas desnecessariamente abrangentes | Escape de `%`, `_` e `[` mantendo parâmetros SQL separados do comando. |
| Identificadores pessoais nas URLs de busca | Consultas migradas para POST JSON; GET de busca recusado. Isso reduz a exposição em logs de URL, mas não remove logs históricos. |
| Uma requisição fechava o pool SQL usado por outras | Pool próprio compartilhado, limitado a cinco conexões, encerrado somente no desligamento do serviço. Consultas de seções aguardam a conclusão do lote mesmo quando uma falha. |
| Falta de cabeçalhos de proteção na API | Helmet, bloqueio de incorporação da API, `nosniff`, política de referência e respostas da API não armazenáveis em cache. |
| Origens não permitidas apenas recebiam resposta sem CORS | Rejeição explícita antes da autenticação. A autorização continua sendo o token e a permissão Firebase; CORS não autentica clientes. |
| Defesa limitada contra scripts injetados no frontend | CSP de produção restringindo scripts, conexões, formulários, objetos e iframes aos recursos necessários. Estilos inline continuam permitidos por compatibilidade com Angular. |
| Requisições pendentes mantinham resultados após saída/troca de busca | Cancelamento das inscrições HTTP ao limpar, mudar a busca ou destruir o componente no logout. |
| Precisão de IDs grandes do SQL | IDs de seleção retornados como texto e números fora da precisão segura recusados. |
| Dependências com avisos conhecidos | Atualização do driver SQL e dependências transitivas; ferramentas Angular atualizadas de forma coerente e gRPC corrigido por override. |
| Ausência de bloqueio automático de arquivos privados na publicação | Scanner antes do deploy e `.gitignore` ampliado. O scanner não imprime o conteúdo detectado e permite a configuração pública Firebase. |

## Pontos que dependem do ambiente

- **TLS do SQL:** `SQL_TRUST_SERVER_CERTIFICATE=true` continua sendo uma exceção explícita de compatibilidade escolhida anteriormente. A conexão é criptografada, mas a identidade do servidor não é validada. A proteção completa exige certificado/CA confiável e nome de servidor correspondente. Esta revisão não desliga a aplicação removendo silenciosamente essa exceção e não apresenta esse modo como equivalente à validação TLS.
- **Chave privada compartilhada anteriormente:** deve ser revogada depois de confirmar que o Render usa a credencial substituta. A tentativa de consultar os metadados IAM com a credencial disponível retornou 403; não foi possível confirmar o estado dessa chave nem revogá-la. Nenhuma chave foi apagada remotamente.
- **Permissões do banco:** o login SQL deve possuir somente as permissões de leitura necessárias. A revisão não altera permissões no SQL remoto.
- **Contas Firebase:** permanece obrigatório login por senha com `panelAccess: true`; contas desativadas e tokens revogados são verificados pelo Admin SDK. A conta de serviço do backend deve ter o mínimo necessário; a liberação administrativa exige uma identidade com permissão de atualização de usuários.
- **Firewall:** limitar o SQL às faixas de saída necessárias do Render ou a uma rede privada. Faixas compartilhadas não identificam exclusivamente este aplicativo.
- **GitHub Pages:** o CSP foi colocado no documento porque o Pages não permite configurar livremente cabeçalhos HTTP. A política de scripts não substitui revisão de código nem resolve todas as formas de incorporação por terceiros.
- **Escala:** os limites são por processo em memória. Para múltiplas instâncias e proteção contra tráfego distribuído, será necessário armazenamento compartilhado/controle de borda.

## Validação

Resultado local: 42 testes do backend e 4 testes do scanner passaram; build de produção e abertura da tela de login no Edge headless concluídos.

- Testes HTTP cobrem autenticação, permissão, origens, método POST, validação, corpos malformados/grandes, parametrização SQL, limites por conta/IP, concorrência, erros sanitizados e ausência de arquivos internos servidos.
- Testes do pool verificam compartilhamento e recuperação após falha de conexão.
- Testes do scanner verificam configuração Firebase pública, arquivo de credencial, chave privada nova no diretório de trabalho e tentativa de ocultação em arquivo de exemplo.
- O build do Angular foi validado com `/Consulta-app/`. Um navegador Edge em modo headless renderizou a tela de login do build de produção; não foram observadas violações CSP nesse teste. Login real e consulta SQL não foram exercitados.
- `npm audit` retornou zero vulnerabilidades conhecidas na raiz e no backend ao final das atualizações. Esse resultado depende da base de avisos disponível na data da revisão e não significa ausência de falhas desconhecidas.
- O scanner examina arquivos rastreados atuais, não todo o histórico Git nem todos os formatos possíveis de segredo. Uma chave exposta exige revogação, mesmo que o arquivo seja removido do repositório.
- Uma verificação adicional de 68 objetos de texto do histórico local não encontrou a senha SQL local conhecida nem a chave privada antiga conhecida. Isso não cobre credenciais desconhecidas nem referências Git ausentes deste checkout.

Referências: [segurança no Express](https://expressjs.com/en/advanced/best-practice-security.html), [proxy no Express](https://expressjs.com/en/guide/behind-proxies/), [TLS do driver SQL](https://tediousjs.github.io/tedious/api-connection.html).
