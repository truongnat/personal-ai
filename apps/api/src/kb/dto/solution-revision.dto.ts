export class SolutionRevisionDto {
  id: string
  solutionId: string
  version: number
  title: string
  summary: string
  contentHash: string
  tagsSnapshot: string[]
  changedBy?: string
  changeReason?: string
  createdAt: string
}

export class SolutionHistoryResponseDto {
  id: string
  title: string
  totalRevisions: number
  revisions: SolutionRevisionDto[]
}

export class RevisionDiffDto {
  fromVersion: number
  toVersion: number
  titleChanged: boolean
  summaryChanged: boolean
  contentChanged: boolean
  tagsAdded: string[]
  tagsRemoved: string[]
  createdAt: string
}
