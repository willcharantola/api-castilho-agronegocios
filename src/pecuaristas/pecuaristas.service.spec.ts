import { ConflictException } from '@nestjs/common';
import { FazendasService } from '../fazendas/fazendas.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreatePecuaristaDto } from './dto/create-pecuarista.dto';
import { PecuaristasService } from './pecuaristas.service';

const DTO = {
  nome_pecuarista: 'João',
  fisico_juridico: 'fisico',
  cpf_cnpj: '000.000.000-00',
  banco: 'BB',
  agencia: '1234',
  conta: '12345',
  chave_pix: 'joao@x.com',
  uuid_origem: '6f1c8a52-3f7e-4f2b-9c55-0d0d7a1c2b11',
  fazendas: [
    {
      nome_fazenda: 'Sonho Meu II',
      municipio: 'Três Lagoas',
      inscricao_estadual: '123456789',
      uuid_origem: '0b7a5a8e-2a7b-4b8e-8f0a-6a3c1d9e4f22',
    },
    { fazenda_id: 7 },
  ],
} as CreatePecuaristaDto;

function criarServico(pecuaristaJaExiste = false) {
  // `tx` é o cliente da transação: tudo do cadastro precisa passar por ele.
  const tx = {
    pecuarista: {
      create: jest.fn().mockResolvedValue({ pecuarista_id: 5 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ pecuarista_id: 5 }),
    },
    fazenda: {
      findMany: jest.fn().mockResolvedValue([{ fazenda_id: 7 }]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ fazenda_id: 8 }),
    },
    pecuarista_fazenda: { createMany: jest.fn() },
  };
  const prisma = {
    pecuarista: {
      findUnique: jest
        .fn()
        .mockResolvedValue(pecuaristaJaExiste ? { pecuarista_id: 5 } : null),
    },
    negocio: { count: jest.fn().mockResolvedValue(2) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const uploads = { prefixoMarcas: () => 'https://bucket/' };
  const fazendas = new FazendasService(
    prisma as unknown as PrismaService,
    uploads as unknown as UploadsService,
  );
  return {
    tx,
    prisma,
    servico: new PecuaristasService(
      prisma as unknown as PrismaService,
      fazendas,
    ),
  };
}

describe('PecuaristasService', () => {
  it('cria pecuarista, fazenda nova e vínculos na mesma transação', async () => {
    const { tx, prisma, servico } = criarServico();
    await servico.create(DTO);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.pecuarista.create).toHaveBeenCalledTimes(1);
    expect(tx.fazenda.create).toHaveBeenCalledTimes(1);
    expect(tx.pecuarista_fazenda.createMany).toHaveBeenCalledWith({
      data: [
        { pecuarista_id: 5, fazenda_id: 8 },
        { pecuarista_id: 5, fazenda_id: 7 },
      ],
      skipDuplicates: true,
    });
  });

  it('reenvio com o mesmo uuid_origem não duplica', async () => {
    const { tx, prisma, servico } = criarServico(true);
    await expect(servico.create(DTO)).resolves.toEqual({ pecuarista_id: 5 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.pecuarista.create).not.toHaveBeenCalled();
  });

  it('falha em um passo propaga o erro (a transação desfaz tudo)', async () => {
    const { tx, servico } = criarServico();
    tx.pecuarista_fazenda.createMany.mockRejectedValue(new Error('falhou'));
    await expect(servico.create(DTO)).rejects.toThrow('falhou');
  });

  it('fazenda nova reenviada (mesmo uuid_origem) é reaproveitada', async () => {
    const { tx, servico } = criarServico();
    tx.fazenda.findUnique.mockResolvedValue({ fazenda_id: 8 });
    await servico.create(DTO);
    expect(tx.fazenda.create).not.toHaveBeenCalled();
  });

  it('desvincular com negócios usando o par → 409', async () => {
    const { servico } = criarServico(true);
    jest
      .spyOn(servico, 'findOne')
      .mockResolvedValue({} as Awaited<ReturnType<typeof servico.findOne>>);
    await expect(servico.desassociarFazenda(5, 7)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
