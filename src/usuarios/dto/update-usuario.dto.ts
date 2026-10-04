import { PartialType } from '@nestjs/swagger';
import { CreateUsuarioDto } from './create-usuario.dto';

/** Todos os campos opcionais; `senha`, se enviada, redefine a senha do usuário. */
export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {}
