import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type ContadorDeNegocios = {
  negocio: { count(args: { where: Prisma.negocioWhereInput }): Promise<number> };
};

/**
 * Fazenda, pecuarista e comprador não podem ser excluídos enquanto houver negócios
 * ligados a eles (o banco recusaria pela chave estrangeira com um erro genérico).
 * `descricao` completa a frase, ex.: "esta fazenda".
 */
export async function impedirExclusaoComNegocios(
  prisma: ContadorDeNegocios,
  where: Prisma.negocioWhereInput,
  descricao: string,
) {
  const negocios = await prisma.negocio.count({ where });
  if (negocios > 0) {
    throw new ConflictException(
      `Não é possível excluir: ${descricao} tem ${negocios} ${negocios === 1 ? 'negócio cadastrado' : 'negócios cadastrados'}. Exclua os negócios antes.`,
    );
  }
}
