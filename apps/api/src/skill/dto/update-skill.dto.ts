import { IsString, IsArray, IsOptional, IsObject } from 'class-validator'

export class UpdateSkillDto {
  @IsString()
  @IsOptional()
  version?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsArray()
  @IsOptional()
  compatible?: string[]

  @IsString()
  @IsOptional()
  changelog?: string

  @IsObject()
  @IsOptional()
  files?: Record<string, string>

  @IsArray()
  @IsOptional()
  tags?: string[]
}
