import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator'

export class SuggestTagsDto {
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  content: string

  @IsString()
  @IsOptional()
  project?: string
}

export class SuggestedTagDto {
  tag: string
  confidence: number // 0-1, higher = more likely to be relevant
  reason: 'frequency' | 'graph' | 'content_match'
  relatedSolutions?: number
}

export class SuggestTagsResponseDto {
  suggestedTags: SuggestedTagDto[]
  topicSummary: string
}
