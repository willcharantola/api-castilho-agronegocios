-- Campos calculados do negócio para o romaneio (instrucoes-campos-negocios.md).
-- Rodar no pgAdmin ANTES de subir a versão da API que grava estes campos.
-- Cria as colunas e preenche os negócios existentes com a mesma regra de
-- NegociosService.recalcularAgregados():
--   - pesos/rendimento: a partir dos gados do negócio; NULL sem gados (modalidade
--     "cabeca" ou negócio ainda vazio) — nunca divide por zero. Sem arredondamento
--     além da escala da coluna.
--   - funrural (1,5%) e senar (0,2%): valor_total × alíquota, em 2 casas; NULL
--     enquanto o negócio não tem valor_total (> 0).

BEGIN;

ALTER TABLE negocio ADD COLUMN peso_total_quilos NUMERIC(14, 4);
ALTER TABLE negocio ADD COLUMN peso_total_arroba NUMERIC(14, 4);
ALTER TABLE negocio ADD COLUMN rendimento_medio  NUMERIC(8, 4);
ALTER TABLE negocio ADD COLUMN peso_medio_arroba NUMERIC(14, 4);
ALTER TABLE negocio ADD COLUMN peso_medio_quilos NUMERIC(14, 4);
ALTER TABLE negocio ADD COLUMN funrural          NUMERIC(14, 2);
ALTER TABLE negocio ADD COLUMN senar             NUMERIC(14, 2);

UPDATE negocio n
SET peso_total_quilos = g.soma_peso,
    peso_total_arroba = g.soma_arroba,
    rendimento_medio  = g.soma_rendimento / g.qtd,
    peso_medio_arroba = g.soma_arroba / g.qtd,
    peso_medio_quilos = g.soma_peso / g.qtd
FROM (
  SELECT negocio_id,
         COUNT(*)                AS qtd,
         SUM(peso_total)         AS soma_peso,
         SUM(peso_arroba)        AS soma_arroba,
         SUM(rendimento_carcaca) AS soma_rendimento
  FROM gado
  GROUP BY negocio_id
) g
WHERE g.negocio_id = n.negocio_id;

UPDATE negocio
SET funrural = ROUND(valor_total * 0.015, 2),
    senar    = ROUND(valor_total * 0.002, 2)
WHERE valor_total > 0;

COMMIT;

-- Conferência: negócios com gado têm todos os campos; os da modalidade "cabeca",
-- só funrural/senar.
SELECT negocio_id, modalidade, qtd_animais, valor_total,
       peso_total_quilos, peso_total_arroba, rendimento_medio,
       peso_medio_arroba, peso_medio_quilos, funrural, senar
FROM negocio
ORDER BY negocio_id;
