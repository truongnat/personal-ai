import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  // Setup Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Personal KB + Skill Hub API')
    .setDescription('Graph-backed knowledge base with AI skill management')
    .setVersion('1.0.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-api-key', in: 'header' },
      'api-key',
    )
    .addApiKey(
      { type: 'apiKey', name: 'x-master-password', in: 'header' },
      'master-password',
    )
    .addTag('health', 'Service health checks')
    .addTag('auth', 'API key management')
    .addTag('kb', 'Knowledge base operations')
    .addTag('skill', 'Skill management')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document)

  const port = process.env.PORT ?? 3000
  await app.listen(port)
  console.log(`API running on port ${port}`)
  console.log(`Swagger docs: http://localhost:${port}/docs`)
}

bootstrap()
