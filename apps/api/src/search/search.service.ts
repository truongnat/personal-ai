import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MeiliSearch } from 'meilisearch'

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name)
  private client: MeiliSearch

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.client = new MeiliSearch({
      host: this.config.get<string>('MEILI_HOST'),
      apiKey: this.config.get<string>('MEILI_MASTER_KEY'),
    })
    await this.ensureIndexes()
    this.logger.log('Meilisearch connected')
  }

  private async ensureIndexes() {
    await this.client.createIndex('solutions', { primaryKey: 'id' }).catch(() => {})
    await this.client.index('solutions').updateSettings({
      searchableAttributes: ['title', 'content'],
      filterableAttributes: ['tags', 'project', 'technologies'],
      sortableAttributes: ['created_at'],
    })

    await this.client.createIndex('skills', { primaryKey: 'id' }).catch(() => {})
    await this.client.index('skills').updateSettings({
      searchableAttributes: ['name', 'description'],
      filterableAttributes: ['tags', 'compatible'],
    })
  }

  async indexDocument(indexName: string, doc: Record<string, any>): Promise<void> {
    await this.client.index(indexName).addDocuments([doc])
  }

  async search(
    indexName: string,
    query: string,
    opts: { limit?: number; filter?: string } = {},
  ): Promise<{ hits: any[]; totalHits: number }> {
    const result = await this.client.index(indexName).search(query, {
      limit: opts.limit ?? 10,
      filter: opts.filter,
    })
    return { hits: result.hits, totalHits: result.estimatedTotalHits ?? 0 }
  }

  async deleteDocument(indexName: string, id: string): Promise<void> {
    await this.client.index(indexName).deleteDocument(id)
  }

  async updateDocument(indexName: string, doc: Record<string, any>): Promise<void> {
    await this.client.index(indexName).updateDocuments([doc])
  }
}
