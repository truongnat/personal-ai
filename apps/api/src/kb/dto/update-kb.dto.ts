import { IsString, IsArray, IsOptional } from 'class-validator'

export class UpdateKbDto {
  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  content?: string

  @IsArray()
  @IsOptional()
  tags?: string[]

  @IsString()
  @IsOptional()
  ticket_ref?: string

  @IsString()
  @IsOptional()
  project?: string

  @IsArray()
  @IsOptional()
  technologies?: string[]
}
