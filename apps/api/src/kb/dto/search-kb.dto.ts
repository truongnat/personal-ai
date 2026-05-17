import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator'

export class SearchKbDto {
  @IsString()
  query: string

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 5

  @IsString()
  @IsOptional()
  tag?: string

  @IsString()
  @IsOptional()
  project?: string
}
