import { IsString, IsOptional } from 'class-validator'

export class GenerateKeyDto {
  @IsString()
  label: string

  @IsOptional()
  @IsString()
  expiresIn?: string
}
