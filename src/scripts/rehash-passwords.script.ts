import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Migração única: re-hasheia senhas de usuários que ainda estão em texto puro
// (dados de seed anteriores). Rodar uma vez antes de considerar o sistema pronto
// para uso real: npm run migrate:rehash-passwords
const SALT_ROUNDS = 10;
const BCRYPT_HASH_REGEX = /^\$2[aby]\$/;

async function main() {
  const prisma = new PrismaClient();
  const usuarios = await prisma.usuario.findMany();

  let rehasheados = 0;
  for (const usuario of usuarios) {
    if (BCRYPT_HASH_REGEX.test(usuario.senha)) {
      continue;
    }
    const hash = await bcrypt.hash(usuario.senha, SALT_ROUNDS);
    await prisma.usuario.update({
      where: { usuario_id: usuario.usuario_id },
      data: { senha: hash },
    });
    rehasheados++;
  }

  console.log(
    `Re-hash concluído: ${rehasheados} de ${usuarios.length} usuário(s) atualizado(s).`,
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Falha ao re-hashear senhas:', error);
  process.exit(1);
});
