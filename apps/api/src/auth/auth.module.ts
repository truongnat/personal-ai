import { Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { ApiKeyGuard } from './api-key.guard'
import { MasterGuard } from './master.guard'

@Module({
  providers: [AuthService, ApiKeyGuard, MasterGuard],
  controllers: [AuthController],
  exports: [AuthService, ApiKeyGuard, MasterGuard],
})
export class AuthModule {}
