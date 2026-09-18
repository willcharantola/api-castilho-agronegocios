import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Traduz erros conhecidos do Prisma em exceções HTTP do Nest, evitando que
 * detalhes internos do Prisma vazem diretamente na resposta da API.
 */
export function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[] | undefined)?.join(', ');
        throw new ConflictException(
          target
            ? `Já existe um registro com o mesmo valor para: ${target}`
            : 'Registro duplicado',
        );
      }
      case 'P2003':
        throw new BadRequestException(
          'Referência inválida: registro relacionado não existe',
        );
      case 'P2025':
        throw new NotFoundException('Registro não encontrado');
    }
  }
  throw error;
}
