import { ConflictException } from '@nestjs/common';
import { impedirExclusaoComNegocios } from './exclusao.util';

function prismaCom(negocios: number) {
  return { negocio: { count: jest.fn().mockResolvedValue(negocios) } };
}

describe('impedirExclusaoComNegocios', () => {
  it('libera a exclusão quando não há negócios', async () => {
    const prisma = prismaCom(0);
    await expect(
      impedirExclusaoComNegocios(prisma, { fazenda_id: 3 }, 'esta fazenda'),
    ).resolves.toBeUndefined();
    expect(prisma.negocio.count).toHaveBeenCalledWith({
      where: { fazenda_id: 3 },
    });
  });

  it('recusa (409) com a quantidade de negócios na mensagem', async () => {
    const erro = impedirExclusaoComNegocios(
      prismaCom(2),
      { comprador_id: 1 },
      'este comprador',
    );
    await expect(erro).rejects.toBeInstanceOf(ConflictException);
    await expect(erro).rejects.toThrow(
      'Não é possível excluir: este comprador tem 2 negócios cadastrados. Exclua os negócios antes.',
    );
  });

  it('usa o singular para um negócio', async () => {
    await expect(
      impedirExclusaoComNegocios(prismaCom(1), {}, 'este pecuarista'),
    ).rejects.toThrow('este pecuarista tem 1 negócio cadastrado.');
  });
});
