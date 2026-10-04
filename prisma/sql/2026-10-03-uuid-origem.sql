-- Idempotência da sincronização offline (funcionamento-offline.md, item 7).
-- Cada cadastro feito offline recebe um UUID no aparelho; a API usa esta coluna
-- para devolver o registro já existente em vez de duplicá-lo caso a sincronização
-- seja reenviada (ex.: a resposta se perdeu numa queda de conexão).
-- Coluna opcional: cadastros feitos online continuam com NULL.
-- Os nomes das constraints seguem o padrão do Prisma, para o `prisma db pull` bater
-- com o schema.prisma já atualizado.

BEGIN;

ALTER TABLE fazenda   ADD COLUMN uuid_origem uuid;
ALTER TABLE vendedor  ADD COLUMN uuid_origem uuid;
ALTER TABLE comprador ADD COLUMN uuid_origem uuid;
ALTER TABLE negocio   ADD COLUMN uuid_origem uuid;
ALTER TABLE gado      ADD COLUMN uuid_origem uuid;

ALTER TABLE fazenda   ADD CONSTRAINT fazenda_uuid_origem_key   UNIQUE (uuid_origem);
ALTER TABLE vendedor  ADD CONSTRAINT vendedor_uuid_origem_key  UNIQUE (uuid_origem);
ALTER TABLE comprador ADD CONSTRAINT comprador_uuid_origem_key UNIQUE (uuid_origem);
ALTER TABLE negocio   ADD CONSTRAINT negocio_uuid_origem_key   UNIQUE (uuid_origem);
ALTER TABLE gado      ADD CONSTRAINT gado_uuid_origem_key      UNIQUE (uuid_origem);

COMMIT;
