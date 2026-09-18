# Instruções — Backend API (NestJS) — Castilho Agronegócios

## Contexto do projeto

Este é o backend definitivo do sistema da Castilho Agronegócios, empresa de compra e revenda de gado. Atualmente existe:

- Um **banco de dados PostgreSQL já criado e populado**, hospedado em uma instância RDS na AWS.
- Um **front-end em Next.js + TypeScript** (com estética "Liquid Glass" voltada para iOS/Safari), que hoje faz requisições **diretamente** ao banco via Prisma nas API Routes do próprio Next.js — isso é uma solução **temporária**, usada apenas para demonstração ao cliente.

O objetivo agora é construir uma **API REST separada, em NestJS + TypeScript**, que vai substituir essa camada temporária. O front-end passará a consumir esta API em vez de acessar o banco diretamente.

## Stack obrigatória

- **Framework**: NestJS
- **Linguagem**: TypeScript
- **ORM**: Prisma (reaproveitar o schema já usado no front-end temporário, ajustado para o modelo atual do banco — ver seção "Modelo de dados")
- **Validação**: `class-validator` e `class-transformer` nos DTOs de entrada
- **Autenticação**: JWT (ver seção "Autenticação e autorização")

## Modelo de dados atual

O banco já existe no RDS com as tabelas abaixo (schema já criado via SQL, não precisa gerar migrations do zero — usar `npx prisma db pull` para introspectar o banco existente e gerar o schema Prisma automaticamente).

**Tabelas e relacionamentos:**
- `empresa` (1) → (N) `usuario`
- `empresa` (1) → (N) `negocio`
- `fazenda` (1) → (N) `vendedor`
- `fazenda` (1) → (N) `negocio`
- `negocio` (1) → (N) `gado`

**Campos com regras de domínio importantes (já aplicadas via CHECK no banco, mas devem ser validadas também na API antes de chegar no banco):**
- `usuario.nivel_acesso`: apenas `"Admin"` ou `"Normal"`
- `vendedor.fisico_juridico`: apenas `"fisico"` ou `"juridico"`
- `negocio.modalidade`: apenas `"arroba"`, `"kg"` ou `"cabeca"`
- `negocio.tipo_gado`: apenas `"Gordo"` ou `"Magro"`
- `negocio.tipo_lote`: apenas `"Vaca"`, `"Boi"`, `"Novilha"`, `"Garrote"`, `"Bezerro"` ou `"Variados"`
- `negocio.rendimento_carcaca`: decimal entre 0 e 100
- `gado.genero`: apenas `"Macho"` ou `"Femea"`

> **Nota:** o campo `negocio.tipo_precificacao` existe no banco, mas seu domínio de valores válidos ainda não foi definido formalmente. Tratar como string livre por enquanto e sinalizar no código com um comentário `// TODO: confirmar domínio de valores válidos com o responsável pelo projeto`.

## Estrutura de módulos sugerida

Seguir a convenção padrão do NestJS, um módulo por entidade principal:

```
src/
  auth/
  usuarios/
  empresas/
  fazendas/
  vendedores/
  negocios/
  gados/
  prisma/           <- módulo compartilhado com o PrismaService
  main.ts
  app.module.ts
```

Cada módulo de entidade (exceto `auth` e `prisma`) deve conter:
- `*.controller.ts` — rotas REST
- `*.service.ts` — lógica de acesso ao banco via Prisma
- `*.module.ts`
- `dto/create-*.dto.ts` e `dto/update-*.dto.ts` — com decorators de validação (`@IsString()`, `@IsNumber()`, `@IsIn([...])`, etc., refletindo as regras de domínio acima)
- `entities/*.entity.ts` (opcional, se quiser tipar o retorno separadamente do schema do Prisma)

## Endpoints esperados (CRUD básico por entidade)

Para cada entidade (`empresas`, `usuarios`, `fazendas`, `vendedores`, `negocios`, `gados`), implementar:

- `GET /entidade` — listar todos
- `GET /entidade/:id` — buscar um específico
- `POST /entidade` — criar
- `PATCH /entidade/:id` — atualizar parcialmente
- `DELETE /entidade/:id` — remover

**Casos especiais:**
- `GET /negocios/:id` deve retornar o negócio **junto com os gados relacionados** (incluir a relação no Prisma `include`), replicando o comportamento que já existe na versão temporária do front.
- `GET /negocios` pode aceitar query params opcionais para filtro por `fazenda_id` e por intervalo de `data_negocio`, já que o front tem uma tela de listagem com filtros (hoje estática/placeholder — ver histórico do projeto).
- `POST /negocios` e `POST /gados` não devem exigir o cálculo de `valor_total`, `peso_calculo` e `peso_arroba` do lado do cliente — esses valores devem ser **recalculados no backend**, no service, antes de persistir, replicando a lógica já usada na demonstração do front-end:
  - `peso_calculo = peso_total * (rendimento_carcaca / 100)`
  - `peso_arroba = peso_calculo / 15`
  - `valor_total = peso_calculo * peso_arroba` *(ver observação abaixo)*

  > **Atenção:** essa última fórmula (`valor_total`) foi definida anteriormente apenas para fins de demonstração visual no front-end, e multiplica duas grandezas de peso entre si, o que foge do cálculo comum do setor (normalmente seria peso da arroba × valor pago por arroba, que é monetário). Antes de implementar essa regra de forma definitiva no backend, confirmar com o responsável pelo projeto se essa é realmente a fórmula de negócio correta ou se era apenas um placeholder de demonstração.

## Autenticação e autorização

- Implementar login via `POST /auth/login`, recebendo `email` e `senha`, retornando um JWT.
- Senhas devem ser armazenadas com hash (`bcrypt`), nunca em texto puro. Se o banco já tiver usuários de teste com senha em texto puro (dados de seed anteriores), gerar uma rota ou script de migração para re-hashear antes de considerar o sistema pronto para uso real.
- Implementar um `Guard` de autenticação (`JwtAuthGuard`) aplicado a todas as rotas, exceto `POST /auth/login`.
- Implementar um `Guard` de autorização baseado em `usuario.nivel_acesso`, restringindo ações sensíveis (ex: exclusão de negócios, gerenciamento de usuários) apenas ao nível `"Admin"`. Definir quais rotas exigem `"Admin"` de forma explícita via decorator customizado (ex: `@Roles('Admin')`).
- Recuperação de senha por e-mail **não faz parte do escopo desta etapa** — está planejada para uma fase futura (ver observações do projeto sobre envio de e-mail via Resend/SES). Deixar a estrutura do módulo `auth` organizada de forma que essa funcionalidade possa ser adicionada depois sem grande refatoração.

## Configuração e ambiente

- Usar `@nestjs/config` para carregar variáveis de ambiente (`.env`), incluindo:
  - `DATABASE_URL` (string de conexão com o RDS PostgreSQL)
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
- **Nunca** commitar o `.env` — confirmar que está no `.gitignore`.
- Habilitar CORS na aplicação (`app.enableCors()`), permitindo especificamente a origem do front-end em produção (domínio do Vercel) e `localhost` durante desenvolvimento.

## Observações gerais para o Claude Code

- Este backend vai eventualmente **substituir** a lógica que hoje está temporariamente implementada nas API Routes do Next.js — ao final da implementação, o objetivo é que o front-end passe a consumir esta API via `fetch`/`axios`, e as API Routes do Next.js baseadas em Prisma direto possam ser removidas.
- Manter tipagem forte em todo o projeto, evitando `any`.
- Adicionar tratamento de erros consistente (ex: `NotFoundException` quando um `id` não existe, `BadRequestException` para dados inválidos), em vez de deixar erros do Prisma vazarem diretamente como resposta da API.
- Ao final, gerar um resumo dos endpoints implementados e quaisquer decisões técnicas tomadas que não estavam explícitas neste documento, para revisão.