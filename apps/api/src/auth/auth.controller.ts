import { Controller, Post, Delete, Get, Body, Param, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { MasterGuard } from './master.guard'
import { GenerateKeyDto } from './dto/generate-key.dto'

@Controller('auth')
@UseGuards(MasterGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('generate-key')
  generateKey(@Body() dto: GenerateKeyDto) {
    return this.authService.generateKey(dto.label, dto.expiresIn)
  }

  @Delete('revoke-key/:id')
  revokeKey(@Param('id') id: string) {
    return this.authService.revokeKey(id)
  }

  @Get('keys')
  listKeys() {
    return this.authService.listKeys().then((keys) => ({ keys }))
  }
}
