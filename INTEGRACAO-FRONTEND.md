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
| Fazendas | `GET/POST /fazendas`, `GET/PATCH/DELETE /fazendas/:id` | — |
| Vendedores | `GET/POST /vendedores`, `GET/PATCH/DELETE /vendedores/:id` | — |
| Negócios | `GET/POST /negocios`, `GET/PATCH /negocios/:id`, `DELETE /negocios/:id` | `DELETE` **exige `Admin`**. `GET /negocios/:id` inclui os `gados` do negócio. `GET /negocios` aceita `?fazenda_id=&data_inicio=&data_fim=` |
| Gados | `GET/POST /gados`, `GET/PATCH/DELETE /gados/:id` | Cada gado pertence a um `negocio_id` |

A documentação interativa (Swagger) está em `${NEXT_PUBLIC_API_URL}/docs` — útil para explorar
payloads exatos e testar chamadas com o botão "Authorize".

## 5. Nomes dos campos (importante)

Os nomes de campo vêm direto das colunas do banco (não são `camelCase`, são `snake_case` com
prefixo da entidade nas chaves primárias). Isso é diferente do que muitas convenções de front-end
usam — ajuste os `types`/`interfaces` do Next.js de acordo.

### `empresa`
`empresa_id`, `cnpj`, `creci`, `nome`, `banco`, `chave_pix`, `agencia`, `conta`

### `usuario`
`usuario_id`, `empresa_id`, `nome`, `sobrenome`, `email`, `nivel_acesso` (`"Admin"` | `"Normal"`)
— **`senha` nunca é retornada** pela API, só é aceita no `POST`/`PATCH`.

### `fazenda`
`fazenda_id`, `nome_fazenda`, `municipio`, `inscricao_estadual`

### `vendedor`
`vendedor_id`, `fazenda_id`, `nome_vendedor`, `fisico_juridico` (`"fisico"` | `"juridico"`),
`cpf_cnpj`, `banco`, `agencia`, `conta`, `chave_pix`

### `negocio`
Campos enviados pelo front no `POST`/`PATCH`:
`empresa_id`, `fazenda_id`, `marchante`, `comprador`, `modalidade` (`"arroba"` | `"kg"` | `"cabeca"`),
`tipo_gado` (`"Gordo"` | `"Magro"`), `tipo_lote` (`"Vaca"` | `"Boi"` | `"Novilha"` | `"Garrote"` |
`"Bezerro"` | `"Variados"`), `tipo_precificacao` (string livre — domínio ainda não definido),
`rendimento_carcaca` (número, 0–100), `data_negocio` (ISO 8601), `comissao`, `valor_arroba`,
`observacao`.

Campos que **a API calcula sozinha e retorna, mas o front não envia**: `negocio_id`, `valor_total`,
`valor_medio`, `qtd_animais`, `mais_pesado`, `mais_leve` — são recalculados automaticamente a
partir dos `gados` vinculados sempre que um gado é criado/editado/removido nesse negócio.

### `gado`
Campos enviados pelo front: `negocio_id`, `peso_total`, `data_pesagem` (ISO 8601), `genero`
(`"Macho"` | `"Femea"`), `denominacao`, `era`, `carimbo`.

Campos calculados pela API (não enviar): `gado_id`, `peso_calculo`, `peso_arroba`, `valor_total`
— calculados a partir de `peso_total` e do `rendimento_carcaca` do negócio pai.

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
| `409` | Conflito de valor único (ex: `email` de usuário já cadastrado) |

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
