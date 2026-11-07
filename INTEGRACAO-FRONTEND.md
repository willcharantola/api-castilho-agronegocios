# Integração Front-end (Next.js) ↔ API Castilho Agronegócios

Guia para o front-end em Next.js parar de acessar o banco diretamente (Prisma nas API Routes) e
passar a consumir esta API REST.

## 1. Variáveis de ambiente no front-end

No projeto Next.js, adicione ao `.env.local` (e ao ambiente de produção na Vercel):

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Em produção, aponte para a URL pública onde este backend estiver hospedado (ex: `https://api.castilhoagro.com.br`).

## 2. CORS

O backend já está configurado (`src/main.ts`) para aceitar `http://localhost:3000` e a origem
definida em `FRONTEND_URL` no `.env` do backend. **Antes de apontar o front para produção**,
confirme que `FRONTEND_URL` no `.env` do backend está com o domínio real da Vercel — caso
contrário o navegador vai bloquear as requisições por CORS.

## 3. Autenticação

### 3.1 Login

```
POST /auth/login
Content-Type: application/json

{ "email": "usuario@castilhoagro.com.br", "senha": "..." }
```

Resposta (`200`):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 1,
    "nome": "Rafael",
    "sobrenome": "Castilho",
    "email": "rafael.castilho@castilhoagro.com.br",
    "nivel_acesso": "Admin",
    "empresa_id": 1
  }
}
```

Credenciais inválidas retornam `401`.

### 3.2 Enviando o token nas demais rotas

Todas as rotas, exceto `POST /auth/login` e `GET /` (health check), exigem o header:

```
Authorization: Bearer <access_token>
```

Sem esse header (ou com token inválido/expirado), a API responde `401 Unauthorized`.

### 3.3 Onde guardar o token

Recomendado: um cookie `httpOnly` setado por uma Route Handler do próprio Next.js (mais seguro
contra XSS) ou, mais simples para uma primeira integração, `localStorage`/estado em memória no
client. Evite guardar o token em variável global sem persistência — o usuário perderia a sessão a
cada refresh.

### 3.4 Client HTTP sugerido

```ts
// lib/api-client.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // token ausente/expirado — redirecionar para login
    localStorage.removeItem('access_token');
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Não autenticado');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Erro ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
```

Exemplo de uso:

```ts
const negocios = await apiFetch<Negocio[]>('/negocios');
const negocio = await apiFetch<Negocio>('/negocios', {
  method: 'POST',
  body: JSON.stringify({ ...dadosDoFormulario }),
});
```

## 4. Endpoints disponíveis

Base URL: `NEXT_PUBLIC_API_URL`. Todos exigem JWT exceto os marcados como **pública**.

| Recurso | Rotas | Observações |
|---|---|---|
| Auth | `POST /auth/login` (**pública**) | Retorna `access_token` + dados do usuário |
| Health | `GET /` (**pública**) | Checagem simples, sem dados |
| Empresas | `GET/POST /empresas`, `GET/PATCH/DELETE /empresas/:id` | — |
| Usuários | `GET/POST /usuarios`, `GET/PATCH/DELETE /usuarios/:id` | **Exige `nivel_acesso: "Admin"`** em todas as rotas |
| Fazendas | `GET /fazendas`, `GET/PATCH/DELETE /fazendas/:id` | Fazenda nova nasce dentro de um pecuarista (ver abaixo). `POST /fazendas` continua só para itens antigos da fila offline |
| Pecuaristas | `GET/POST /pecuaristas`, `GET/PATCH/DELETE /pecuaristas/:id`, `POST /pecuaristas/:id/fazendas`, `DELETE /pecuaristas/:id/fazendas/:fazendaId` | `POST` cria pecuarista + fazendas numa transação. `DELETE` do vínculo responde `409` se houver negócio com o par |
| Negócios | `GET/POST /negocios`, `GET /negocios/resumo`, `GET/PATCH /negocios/:id`, `PATCH /negocios/:id/concluir`, `DELETE /negocios/:id` | `DELETE` **exige `Admin`** (lotes e gados saem junto). `GET /negocios/:id` inclui os `lotes`, cada um com seus `gados`. `GET /negocios` e `GET /negocios/resumo` aceitam `?fazenda_id=&data_inicio=&data_fim=`. Comissão restrita a Admin (ver "Permissões por perfil") |
| Lotes | `GET/POST /negocios/:negocioId/lotes`, `GET/PATCH/DELETE /lotes/:id` | `DELETE` responde `409` se o lote tiver cabeças |
| Gados | `GET/POST /gados`, `GET/PATCH/DELETE /gados/:id` | Cada gado pertence a um `lote_id` (e ao negócio pelo lote) |
| Configurações | `GET /configuracoes/impostos`, `PATCH /configuracoes/impostos`, `GET /configuracoes/empresa`, `PATCH /configuracoes/empresa` | Alíquotas e dados cadastrais da empresa do usuário logado. `PATCH` **exige `Admin`** |
| Compradores (frigoríficos) | `GET/POST /compradores`, `GET /compradores/opcoes?busca=&limite=&pagina=`, `GET/PATCH/DELETE /compradores/:id` | Sem `telefone` (bd-12) nem `pessoa_contato` (bd-13); `inscricao_estadual` obrigatória (texto livre, até 12, ex.: `"ISENTO"`). `opcoes` devolve frigoríficos **e** pecuaristas no formato do comprador unificado, ordenados por nome: `{ itens, total }` |
| Tipos de gado | `GET /tipos-gado`, `POST /tipos-gado`, `PATCH/DELETE /tipos-gado/:id` | Nomes sugeridos para lotes, da empresa do JWT. `POST/PATCH/DELETE` **exigem `Admin`**; nome repetido (sem maiúsculas) → `409` |

A documentação interativa (Swagger) está em `${NEXT_PUBLIC_API_URL}/docs` — útil para explorar
payloads exatos e testar chamadas com o botão "Authorize".

## 5. Nomes dos campos (importante)

**Documentos (validados pela API, gravados formatados):** `pecuarista.cpf_cnpj` precisa ser CPF válido
(pessoa `"fisico"`) ou CNPJ válido (`"juridico"`); `comprador.cnpj` e `fazenda.cnpj` (opcional) precisam
ser CNPJ válido; `fazenda.inscricao_estadual` segue o formato de MS `00.000.000-0`. Todos aceitam só os
dígitos. Dígito verificador errado ou formato inválido → `400`.

Os nomes de campo vêm direto das colunas do banco (não são `camelCase`, são `snake_case` com
prefixo da entidade nas chaves primárias). Isso é diferente do que muitas convenções de front-end
usam — ajuste os `types`/`interfaces` do Next.js de acordo.

### `empresa`
`empresa_id`, `cnpj`, `creci`, `nome`, `banco`, `chave_pix`, `agencia`, `conta`

### `usuario`
`usuario_id`, `empresa_id`, `nome`, `sobrenome`, `email`, `nivel_acesso` (`"Admin"` | `"Normal"`)
— **`senha` nunca é retornada** pela API, só é aceita no `POST`/`PATCH`.

### `fazenda`
`fazenda_id`, `nome_fazenda`, `municipio`, `cnpj` (opcional: aceita com ou sem pontuação, grava
`00.000.000/0000-00`; dígitos verificadores inválidos → `400`; `''`/`null` limpa),
`inscricao_estadual`, `marca_url`, `marca_escrita`,
`endereco_fazenda` (opcional, até 200) e `localizacao_google` (opcional, até 500): link https do
Google Maps (`www.google.com/maps`, `google.com/maps`, `maps.google.com`, `maps.app.goo.gl`,
`goo.gl/maps`) **ou** coordenadas `"latitude,longitude"` com ponto decimal (ex.: `-20.7123,-51.6543`,
espaço após a vírgula é aceito). Qualquer outro texto responde `400`. Os dois campos também são
aceitos nas fazendas novas de `POST /pecuaristas` e `POST /pecuaristas/:id/fazendas`.

### `pecuarista`
`pecuarista_id`, `nome_pecuarista`, `fisico_juridico` (`"fisico"` | `"juridico"`), `cpf_cnpj`,
`banco`, `agencia` (até 10), `conta` (até 20), `chave_pix`, `pecuarista_fazenda` (vínculos N:N, com a
`fazenda`).

`POST /pecuaristas` exige `fazendas` com pelo menos um item, cada um **ou** `{ "fazenda_id": 7 }`
(vincula uma existente) **ou** os dados de uma fazenda nova (`nome_fazenda`, `municipio`,
`inscricao_estadual`, `marca_url?`, `marca_escrita?`, `endereco_fazenda?`, `localizacao_google?`,
`uuid_origem?`). Tudo é gravado numa transação;
reenviar com o mesmo `uuid_origem` (do pecuarista e de cada fazenda nova) não duplica nada.
`POST /pecuaristas/:id/fazendas` aceita um item no mesmo formato; vincular de novo não é erro.
`PATCH /pecuaristas/:id` só altera os dados (não aceita mais `fazenda_ids`).

### `negocio`
Campos enviados pelo front no `POST`/`PATCH`:
`empresa_id`, `pecuarista_id`, `fazenda_id`, `comprador` (`{ "tipo": "frigorifico" | "pecuarista", "id": 12 }`),
`modalidade` (`"arroba"` | `"kg"` | `"cabeca"`),
`tipo_gado` (`"Gordo"` | `"Reposicao"`), `tipo_negocio` (`"Desconto em folha"` | `"Livre"` | `"Funrural"`),
`data_negocio` (ISO 8601), `porcentagem_comissao` (0–100, 2 casas; R$/@ ou %, ver abaixo), `observacao`.
`comprador_id` (formato antigo), `valor_unidade` (bd-13: é de cada lote), `tipo_lote`, `media_carimbo`,
os rendimentos por raça, `qtd_animais`, `valor_total_bruto` e `valor_total_liquido` **não são aceitos** (`400`).

**Comprador (bd-12): frigorífico ou pecuarista.** A API grava `comprador_id` (frigorífico) **ou**
`comprador_pecuarista_id` (pecuarista) e deixa a outra coluna `null`. Sem comprador → `400` "Informe o
comprador"; id inexistente → `400` "Comprador não encontrado"; pecuarista igual ao `pecuarista_id`
(inclusive ao trocar o vendedor num `PATCH`) → `400` "O comprador não pode ser o próprio vendedor".
Toda resposta de negócio traz `comprador` unificado (as duas colunas continuam presentes):

```json
{ "tipo": "frigorifico", "id": 3, "nome": "Frigorífico X", "documento": "00.000.000/0001-00",
  "municipio": "Campo Grande", "inscricao_estadual": "28.123.456-7" }
```

Para pecuarista: `nome` = nome do pecuarista, `documento` = CPF/CNPJ, `municipio` = o da primeira
fazenda dele, `inscricao_estadual` = `null`. Mudar a modalidade recalcula todas as cabeças, lotes,
comissão, impostos e o valor líquido do negócio. Pecuarista ou frigorífico com negócios (como vendedor
ou comprador) não pode ser excluído (`409`).

A fazenda precisa estar vinculada ao pecuarista (FK composta no banco): senão, `400` "A fazenda não
pertence ao pecuarista selecionado". Mudar o `tipo_negocio` recalcula Funrural, Senar e o líquido.

Campos que **a API calcula sozinha e retorna, mas o front não envia** (a partir dos lotes e de
todas as cabeças de todos os lotes, a cada criação/edição/exclusão de lote ou gado):
`qtd_animais` (soma dos lotes), `valor_total_bruto` (soma de `valor_total_lote`; era `valor_total` até o
bd-12), `valor_total_liquido` (= bruto − `funrural` − `senar`; a comissão não entra), `valor_medio`,
`peso_total_quilos`/`_arroba`, `peso_medio_quilos`/`_arroba`, `mais_pesado_quilos`/`_arroba`,
`mais_leve_quilos`/`_arroba`, `rendimento_medio` = soma(`peso_calculo`) / soma(`peso_total`) × 100
(ponderado, não a média dos lotes), `comissao`, `funrural`, `senar`. Sem cabeças, pesos e médias
ficam `null`.

**Funrural e Senar** (R$, nunca `null`), com as alíquotas da empresa copiadas para o negócio na
criação (`aliquota_funrural`, `aliquota_senar`): `"Desconto em folha"` → só Senar;
`"Funrural"` → só Funrural; `"Livre"` → ambos 0,00.

**Horários de pesagem** (registrados pelo servidor, nunca enviados pelo front — enviá-los gera 400):
`hora_inicio_pesagem` é gravado no primeiro `POST /gados` do negócio (não é sobrescrito nos
seguintes); `hora_fim_pesagem` é gravado em `PATCH /negocios/:id/concluir` (botão "Concluir").
Os horários são a **hora local do cliente**: o front envia o fuso do aparelho no header
`X-Fuso-Horario` (ex.: `America/Cuiaba`) e a API converte o instante do servidor para esse fuso
(sem header ou com fuso inválido, usa `America/Sao_Paulo`).

**Comissão** (`comissao`, R$) é calculada pela API conforme `modo_comissao`, campo derivado que vem
em toda resposta de negócio (não é coluna e não é aceito em escrita):

| `tipo_gado` | `modalidade` | `modo_comissao` | `porcentagem_comissao` guarda | `comissao` |
|---|---|---|---|---|
| Gordo | `arroba` ou `kg` | `por_arroba` | R$ por arroba (ex.: 2,00) | valor × `peso_total_quilos` ÷ 15 (peso **vivo**, não a arroba de carcaça) |
| Gordo | `cabeca` | `percentual` | percentual | `valor_total_bruto` × valor ÷ 100 |
| Reposicao | qualquer | `percentual` | percentual | `valor_total_bruto` × valor ÷ 100 |

A arroba não é arredondada antes de multiplicar (2,00 × 350 kg ÷ 15 = 46,666… → **46,67**); só o
resultado final, `ROUND_HALF_UP`. Sem cabeças pesadas, a comissão por arroba é 0,00. Fica `null`
enquanto `porcentagem_comissao` for `null`. É recalculada a cada criação/edição/exclusão de lote ou
gado, mudança de valor/rendimento do lote e de `tipo_gado`, `modalidade` ou `porcentagem_comissao`.
Um `PATCH` que muda `tipo_gado`/`modalidade` **de modo** (ex.: Gordo → Reposicao, ou `kg` → `cabeca`
no gordo) descarta o valor informado (`porcentagem_comissao` e `comissao` ficam `null`), salvo se um
novo `porcentagem_comissao` vier no mesmo `PATCH`; Gordo `arroba` ↔ `kg` mantém o valor. A regra
está em `src/negocios/calculo.util.ts` (`modoComissao`, `calcularComissao`) e é replicada no front
em `src/lib/comissao.ts`.

> Nota para o modelo relacional (PDF): `porcentagem-comissao` — para gado Gordo em modalidade
> arroba/kg guarda R$ por arroba; nos demais casos guarda percentual.

**Exclusão de fazenda, pecuarista e comprador:** `DELETE /fazendas/:id`, `/pecuaristas/:id` e `/compradores/:id` respondem `409` enquanto houver negócios ligados ao registro (a mensagem traz a quantidade). Exclua os negócios antes.

**Permissões por perfil (comissão):** para usuário `Normal`, toda resposta de negócio
(`GET /negocios`, `GET /negocios/:id`, `POST`, `PATCH`, `PATCH /concluir`) traz `comissao`,
`porcentagem_comissao` e `modo_comissao` como `null` (os campos continuam presentes). `porcentagem_comissao` enviado
por um Normal é **ignorado em silêncio** (sem `400`; na edição o valor gravado é preservado; na
criação fica `null` até um Admin preencher). Admin recebe e envia normalmente.

**`GET /negocios/resumo`** (Home e Dashboard): `{ negocios_realizados, comissao_total, total_cabecas }`
no período, com os mesmos filtros da listagem. Para Normal as três vêm `null` (nem são calculadas);
para Admin, período sem negócios → zeros.

**Troca de modalidade** (`PATCH` com `modalidade`): para `"cabeca"` só com no máximo um lote e
nenhuma cabeça (senão `400`); o lote vira "Lote único" com rendimento 100. Para `"kg"` os lotes
passam a ter rendimento 100. As cabeças são recalculadas.

### `lote`
`POST /negocios/:negocioId/lotes` e `PATCH /lotes/:id`:
`nome_lote` (até 30, **único no negócio** ignorando maiúsculas/minúsculas — repetido dá `400`),
`valor_unidade` (obrigatório no `POST`, ≥ 0, 2 casas: R$/@, R$/kg ou R$/cabeça conforme a modalidade —
**cada lote tem o seu**, bd-13), `tipo_lote` (`"Vaca"` | `"Boi"` | `"Novilha"` | `"Garrote"` | `"Bezerro"` | `"Variados"`), `genero`
(`"Macho"` | `"Femea"`), `rendimento_carcaca` (0–100, 2 casas), `media_carimbo` (opcional, texto livre,
até 30) e `ano_carimbo` (opcional, 4 dígitos) — `''` vira `null` —, `uuid_origem?` (só no `POST`).
O nome do lote é texto livre: as sugestões vêm de `GET /tipos-gado` (o nome é copiado, sem ligação).

Regras por modalidade do negócio:
- `"arroba"`: `nome_lote` e `rendimento_carcaca` obrigatórios.
- `"kg"`: `nome_lote` obrigatório; a API grava `rendimento_carcaca = 100`.
- `"cabeca"`: um único lote. Envie `qtd_animais` (inteiro ≥ 1, obrigatório) e omita o nome — a API
  grava `"Lote único"` e rendimento 100. Um segundo `POST` dá `400`; para mudar, `PATCH /lotes/:id`.
  `qtd_animais` nas outras modalidades dá `400`.

Calculados pela API: `qtd_animais` (cabeças pesadas; em `"cabeca"`, a informada),
`valor_total_lote` (soma das cabeças; em `"cabeca"`, `lote.valor_unidade × qtd_animais`),
`valor_medio_cabeca_lote`, pesos totais/médios, mais pesado/mais leve (quilos e arroba) e
`rendimento_medio`. Mudar `rendimento_carcaca` ou `valor_unidade` recalcula as cabeças do lote, o lote e o negócio. `DELETE /lotes/:id` com cabeças responde `409` ("Este lote tem X cabeças
pesadas. Remova ou mova as cabeças antes de excluir").

### `gado`
Campos enviados pelo front: `lote_id`, `peso_total`, `data_pesagem?` (ISO 8601; omitida, vale a data
atual), `horario_pesagem?` e `uuid_origem?` (fila offline). `negocio_id`, `genero`, `denominacao`,
`ano_carimbo`, `rendimento_carcaca` e `carimbo` não existem mais — enviados, dão `400`.
`PATCH /gados/:id` com outro `lote_id` move a cabeça (só para lote do **mesmo negócio**, senão `400`)
e recalcula os dois lotes (a cabeça passa a valer pelo rendimento e preço do lote novo). Negócio `"cabeca"` não aceita gados (`400`).

Calculados pela API (não enviar): `gado_id`, `peso_calculo`, `peso_arroba`, `valor_total`:
- `"arroba"`: `peso_calculo = peso_total × rendimento_carcaca do lote / 100`, `peso_arroba =
  peso_calculo / 15`, `valor_total = peso_arroba × lote.valor_unidade`.
- `"kg"`: `peso_calculo = peso_total`, `peso_arroba = peso_total / 15` (Gordo) ou `peso_total / 30`
  (Reposição), `valor_total = peso_total × lote.valor_unidade`. A arroba é só informativa: não muda o valor.
  Trocar o `tipo_gado` de um negócio `"kg"` recalcula as cabeças de todos os lotes.

Lotes e gados só são visíveis/alteráveis para usuários da empresa do negócio (outra empresa → `404`).

## 6. Tratamento de erros

Formato padrão de erro (Nest):

```json
{ "statusCode": 400, "message": "mensagem ou array de mensagens de validação", "error": "Bad Request" }
```

| Status | Quando acontece |
|---|---|
| `400` | Corpo inválido (`class-validator`) ou violação de FK/constraint no banco |
| `401` | Sem token, token inválido/expirado, ou credenciais de login erradas |
| `403` | Usuário autenticado mas sem `nivel_acesso: "Admin"` para uma rota restrita |
| `404` | Registro não encontrado pelo `:id` |
| `409` | Conflito de valor único (ex: `email` de usuário já cadastrado) ou exclusão bloqueada (lote com cabeças, vínculo pecuarista–fazenda em uso) |

## 7. Roteiro de migração sugerido

1. Suba o backend localmente (`npm run start:dev`, porta `3001`) apontando para o mesmo RDS que o
   front já usa.
2. No Next.js, crie o `lib/api-client.ts` (seção 3.4) e uma tela/fluxo de login que chama
   `POST /auth/login` e guarda o `access_token`.
3. Migre uma API Route por vez: troque a query Prisma direta pela chamada equivalente a este
   backend via `apiFetch`, mantendo a mesma assinatura de retorno usada pelos componentes (ou
   ajuste os componentes para os nomes de campo reais — seção 5).
4. Depois que todas as telas estiverem usando a nova API, remova as API Routes baseadas em Prisma
   e a dependência do Prisma no projeto Next.js (o Prisma client direto ao banco deixa de ser
   necessário ali).
5. Configure `FRONTEND_URL` no `.env` do backend com o domínio de produção da Vercel antes do
   deploy final.

## Sincronização offline (PWA)

Cadastros feitos sem internet ficam numa fila no aparelho (IndexedDB) e são enviados depois,
na ordem fazenda → pecuarista → comprador → negócio → atualização de negócio → lote → gado → conclusão.

- `uuid_origem` (opcional, UUID) nos `POST` de `/fazendas`, `/pecuaristas`, `/compradores`,
  `/negocios`, `/negocios/:id/lotes` e `/gados`: se já existir um registro com esse valor, a API **devolve o existente**
  em vez de criar outro (reenvio após uma resposta perdida não duplica). Não é editável via `PATCH`.
  Requer as colunas criadas por `prisma/sql/2026-10-03-uuid-origem.sql`.
- `POST /gados` com `uuid_origem` aceita `horario_pesagem` (`HH:mm` ou `HH:mm:ss`): a hora local
  em que o gado foi pesado no aparelho. Sem `uuid_origem`, o campo é ignorado e vale a hora do
  servidor. O primeiro gado do negócio define `hora_inicio_pesagem` com esse mesmo horário.
- `PATCH /negocios/:id/concluir` aceita no corpo `{ "hora_fim_pesagem": "HH:mm:ss" }` (hora da
  conclusão no aparelho, enviada pela fila offline). Corpo vazio: hora do servidor, como antes.

## Usuários

- `POST /auth/login` → `{ access_token, usuario }`, com `usuario` incluindo `usuario_id`, `empresa_id` e
  `nivel_acesso` (nunca a senha). E-mail é comparado em minúsculas.
- `GET /auth/me` → dados atuais do usuário logado.
- A senha definida pelo administrador no cadastro vale até ser alterada (não há troca obrigatória
  no primeiro acesso).
- `GET/POST /usuarios`, `GET/PATCH/DELETE /usuarios/:id`: só `Admin`, só usuários da própria empresa
  (outra empresa → 404). `empresa_id` vem do admin autenticado. `senha` no `PATCH` só se preenchida.
  E-mail duplicado → 409. Não é permitido excluir a própria conta nem excluir/rebaixar o último admin (400).
- O token é validado contra o banco a cada requisição: usuário excluído → 401; mudança de nível vale na hora.

## Dados da empresa

- `GET /configuracoes/empresa` → `{ nome, cnpj, creci, banco, agencia, conta, chave_pix }` — qualquer usuário logado.
- `PATCH /configuracoes/empresa` com os mesmos campos, todos obrigatórios — só `Admin` (senão 403). O CNPJ
  é validado pelos dígitos verificadores e salvo no formato `00.000.000/0000-00`.
- `POST/PATCH/DELETE /empresas` agora também exigem `Admin`.

## Impostos e taxas (Funrural e Senar)

- `GET /configuracoes/impostos` → `{ aliquota_funrural, aliquota_senar }` (números, em %: `1.5` = 1,5%)
  da empresa do usuário logado (`empresa_id` vem do token).
- `PATCH /configuracoes/impostos` `{ aliquota_funrural, aliquota_senar }` — só `Admin` (senão 403);
  ambos obrigatórios, de 0 a 100, até 2 casas decimais.
- Ao criar um negócio, a API copia as alíquotas da empresa para `negocio.aliquota_funrural` /
  `negocio.aliquota_senar` (não enviar no POST/PATCH). `funrural` e `senar` (R$) são sempre calculados
  com as alíquotas gravadas no próprio negócio: mudar a configuração só afeta negócios novos.

## Dados bancários do pecuarista (opcionais)

- Requer no banco: `ALTER TABLE vendedor ALTER COLUMN banco DROP NOT NULL, ALTER COLUMN agencia DROP NOT NULL,
  ALTER COLUMN conta DROP NOT NULL, ALTER COLUMN chave_pix DROP NOT NULL;` (rodar antes de publicar a API).
- `banco`, `agencia`, `conta` e `chave_pix` são opcionais no `POST`/`PATCH /pecuaristas`; texto vazio (ou só
  espaços) é gravado como `null`, e a resposta traz `null` quando não há dado.
- Banco, agência e conta: os três ou nenhum. Conta pela metade → 400 ("Dados bancários incompletos ...
  Faltando: ..."). No `PATCH`, a regra considera o que já está gravado (campo ausente mantém o valor; `null`
  apaga). A chave Pix é independente.
