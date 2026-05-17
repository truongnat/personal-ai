import { IsString, IsArray, IsOptional, IsBoolean } from 'class-validator'

export class ComposeSkillDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsArray()
  skills: string[]

  @IsBoolean()
  @IsOptional()
  kb_integration?: boolean
}
