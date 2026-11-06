import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  // Security headers — allow iframes from any origin for the public assistant
  app.use(
    helmet({
      contentSecurityPolicy: false, // Configured at CDN/load-balancer level
      frameguard: false, // Allow iframe embedding for the widget
    }),
  );

  // CORS — restrict to configured origins in production
  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: false,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpErrorFilter());

  const swagger = new DocumentBuilder()
    .setTitle('AI Knowledge & Decision Assistant')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.PORT ?? 3000);
  // Bind to 0.0.0.0 so Render/Docker exposes the port correctly
  await app.listen(port, '0.0.0.0');
  console.log(`API server listening on 0.0.0.0:${port}`);
}

bootstrap();
