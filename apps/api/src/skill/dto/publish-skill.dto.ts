import { IsString, IsArray, IsOptional, IsObject, IsBoolean } from 'class-validator'

export class PublishSkillDto {
  @IsString()
  name: string

  @IsString()
  version: string

  @IsString()
  description: string

  @IsArray()
  @IsOptional()
  compatible?: string[]

  @IsString()
  @IsOptional()
  changelog?: string

  @IsObject()
  files: Record<string, string>

  @IsArray()
  @IsOptional()
  tags?: string[]
}
