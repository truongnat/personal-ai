import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { Neo4jModule } from './neo4j/neo4j.module'
import { CacheModule } from './cache/cache.module'
import { SearchModule } from './search/search.module'
import { AuthModule } from './auth/auth.module'
import { KbModule } from './kb/kb.module'
import { SkillModule } from './skill/skill.module'
import { AppController } from './app.controller'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    Neo4jModule,
    CacheModule,
    SearchModule,
    AuthModule,
    KbModule,
    SkillModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
