import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('API Castilho Agronegócios')
      .setDescription(
        'API REST que substitui o acesso direto ao banco feito hoje pelas API Routes do Next.js.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument);
  }

  const frontendUrl = configService.get<string>('FRONTEND_URL');
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000'].filter(
      (origin): origin is string => !!origin,
    ),
    credentials: true,
  });

  const port = configService.get<string>('PORT') ?? 3001;
  await app.listen(port, '0.0.0.0');
}
bootstrap();