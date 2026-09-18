import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): string {
    return 'API Castilho Agronegócios no ar';
  }
}
