# API Castilho Agronegócios

Backend em NestJS + TypeScript + Prisma que substitui a camada temporária de acesso direto ao
banco (Prisma nas API Routes do Next.js). Consome o mesmo PostgreSQL (RDS) já usado pelo front-end.

## Setup

```bash
npm install          # roda `prisma generate` automaticamente (postinstall)
cp .env.example .env # preencher DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, FRONTEND_URL
```

O schema em `prisma/schema.prisma` foi gerado por introspecção (`npx prisma db pull`) contra o RDS
real. Se o schema do banco mudar, rode novamente:

```bash
npm run prisma:pull      # reintrospecta o banco real e sobrescreve prisma/schema.prisma
npm run prisma:generate  # regenera o Prisma Client a partir do schema atualizado
```

## Rodando

```bash
npm run start:dev   # watch mode, porta padrão 3001 (ou PORT do .env)
npm run build
npm run start:prod
```

## Migração de senhas em texto puro

Se o banco tiver usuários de seed com senha em texto puro, rodar uma vez antes de considerar o
sistema pronto para uso real:

```bash
npm run migrate:rehash-passwords
```

O script identifica senhas que não têm formato de hash bcrypt e as re-hasheia com bcrypt.

## Testes

```bash
npm run test
npm run test:e2e   # requer DATABASE_URL válido (PrismaService conecta no bootstrap)
npm run test:cov
```

## Autenticação

`POST /auth/login` (rota pública) recebe `{ email, senha }` e retorna um JWT. Todas as demais
rotas exigem `Authorization: Bearer <token>`. Rotas sensíveis (gerenciamento de `usuarios` e
`DELETE /negocios/:id`) exigem `nivel_acesso: "Admin"`.

## Documentação (Swagger)

Com a aplicação rodando, a documentação interativa fica em `http://localhost:3001/docs` (rota
pública, não passa pelo `JwtAuthGuard`). Use o botão "Authorize" para colar o JWT retornado por
`POST /auth/login` e testar as demais rotas diretamente pela UI.
