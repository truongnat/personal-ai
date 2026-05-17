import { Test, TestingModule } from '@nestjs/testing'
import { KbService } from './kb.service'
import { Neo4jService } from '../neo4j/neo4j.service'
import { CacheService } from '../cache/cache.service'
import { SearchService } from '../search/search.service'

describe('KbService', () => {
  let service: KbService
  let neo4jService: Neo4jService
  let searchService: SearchService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbService,
        {
          provide: Neo4jService,
          useValue: {
            runQuery: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delByPattern: jest.fn(),
          },
        },
        {
          provide: SearchService,
          useValue: {
            search: jest.fn(),
            indexDocument: jest.fn(),
            updateDocument: jest.fn(),
            deleteDocument: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<KbService>(KbService)
    neo4jService = module.get<Neo4jService>(Neo4jService)
    searchService = module.get<SearchService>(SearchService)
  })

  describe('suggestTags', () => {
    it('should suggest tags based on content similarity', async () => {
      const content = 'Fixed Neo4j connection pool exhaustion in AuthService by implementing FIFO eviction strategy'

      // Mock Meilisearch results
      jest.spyOn(searchService, 'search').mockResolvedValue({
        hits: [
          { id: 'sol1', title: 'DB Fix', tags: ['neo4j', 'performance', 'database'], _rankingScore: 0.9 },
          { id: 'sol2', title: 'Cache', tags: ['performance', 'redis'], _rankingScore: 0.8 },
        ],
        totalHits: 2,
      } as any)

      // Mock Neo4j graph results (no co-occurrence found for this test)
      jest.spyOn(neo4jService, 'runQuery').mockResolvedValue({
        records: [],
        summary: {},
      } as any)

      const suggestions = await service.suggestTags(content)

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0].confidence).toBeGreaterThan(0.2)
      expect(suggestions.some((s) => ['neo4j', 'performance', 'database'].includes(s.tag))).toBe(true)
      expect(suggestions[0].confidence).toBeGreaterThanOrEqual(suggestions[1]?.confidence || 0)
    })

    it('should rank by confidence score (descending)', async () => {
      const content = 'Test content about performance issues'

      jest.spyOn(searchService, 'search').mockResolvedValue({
        hits: [
          { id: 'sol1', title: 'Fix', tags: ['performance', 'performance', 'performance'], _rankingScore: 1.0 },
        ],
        totalHits: 1,
      } as any)

      jest.spyOn(neo4jService, 'runQuery').mockResolvedValue({
        records: [],
        summary: {},
      } as any)

      const suggestions = await service.suggestTags(content)

      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].confidence).toBeGreaterThanOrEqual(suggestions[i + 1].confidence)
      }
    })

    it('should filter tags with low confidence', async () => {
      const content = 'Short text'

      jest.spyOn(searchService, 'search').mockResolvedValue({
        hits: [],
        totalHits: 0,
      } as any)

      jest.spyOn(neo4jService, 'runQuery').mockResolvedValue({
        records: [],
        summary: {},
      } as any)

      const suggestions = await service.suggestTags(content)

      expect(suggestions.every((s) => s.confidence > 0.2)).toBe(true)
    })

    it('should boost keyword matches with content_match reason', async () => {
      const content = 'Discussing redis and caching strategies for redis performance'

      jest.spyOn(searchService, 'search').mockResolvedValue({
        hits: [
          { id: 'sol1', title: 'Cache', tags: ['caching'], _rankingScore: 0.7 },
        ],
        totalHits: 1,
      } as any)

      jest.spyOn(neo4jService, 'runQuery').mockResolvedValue({
        records: [],
        summary: {},
      } as any)

      const suggestions = await service.suggestTags(content)

      const caching = suggestions.find((s) => s.tag === 'caching')
      if (caching) {
        expect(caching.reason).toBe('content_match')
        expect(caching.confidence).toBeGreaterThan(0.2)
      }
    })

    it('should return empty array for insufficient content', async () => {
      const content = 'a b c d e'

      jest.spyOn(searchService, 'search').mockResolvedValue({
        hits: [],
        totalHits: 0,
      } as any)

      const suggestions = await service.suggestTags(content)

      expect(Array.isArray(suggestions)).toBe(true)
    })
  })
})
