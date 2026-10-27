-- Ajustes pós-reunião com o cliente (ajustes.md).
-- Rodar no pgAdmin ANTES de subir a versão da API destes ajustes.
--   1. Fim da troca de senha no primeiro acesso: usuario.primeiro_acesso zerado
--      (a coluna fica sem uso; o DROP é opcional, no fim deste arquivo).
--   3. Alíquotas de Funrural e Senar configuráveis por empresa e gravadas em
--      cada negócio (os negócios existentes ficam com as alíquotas fixas de antes).
-- Tabelas e colunas "vendedor" NÃO são renomeadas: a API mapeia via Prisma.

BEGIN;

-- 1. Primeiro acesso
UPDATE usuario SET primeiro_acesso = FALSE WHERE primeiro_acesso;
ALTER TABLE usuario ALTER COLUMN primeiro_acesso SET DEFAULT FALSE;

-- 3. Alíquotas (em %, ex.: 1.50 = 1,5%)
ALTER TABLE empresa ADD COLUMN aliquota_funrural NUMERIC(5, 2) NOT NULL DEFAULT 1.50
  CHECK (aliquota_funrural BETWEEN 0 AND 100);
ALTER TABLE empresa ADD COLUMN aliquota_senar NUMERIC(5, 2) NOT NULL DEFAULT 0.20
  CHECK (aliquota_senar BETWEEN 0 AND 100);

-- Alíquotas usadas por aquele negócio (copiadas da empresa na criação).
ALTER TABLE negocio ADD COLUMN aliquota_funrural NUMERIC(5, 2)
  CHECK (aliquota_funrural BETWEEN 0 AND 100);
ALTER TABLE negocio ADD COLUMN aliquota_senar NUMERIC(5, 2)
  CHECK (aliquota_senar BETWEEN 0 AND 100);

UPDATE negocio
SET aliquota_funrural = 1.50,
    aliquota_senar    = 0.20
WHERE aliquota_funrural IS NULL OR aliquota_senar IS NULL;

COMMIT;

-- Conferência
SELECT empresa_id, nome, aliquota_funrural, aliquota_senar FROM empresa ORDER BY empresa_id;
SELECT negocio_id, valor_total, aliquota_funrural, aliquota_senar, funrural, senar
FROM negocio
ORDER BY negocio_id;
SELECT COUNT(*) AS usuarios_com_primeiro_acesso FROM usuario WHERE primeiro_acesso;

-- OPCIONAL — só depois de a nova versão estar no ar (nada mais usa a coluna):
-- ALTER TABLE usuario DROP COLUMN primeiro_acesso;
