import { Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import neo4j from 'neo4j-driver'
import { Neo4jService } from '../neo4j/neo4j.service'
import { CacheService } from '../cache/cache.service'
import { SearchService } from '../search/search.service'
import { PushKbDto } from './dto/push-kb.dto'
import { UpdateKbDto } from './dto/update-kb.dto'
import { SuggestedTagDto } from './dto/suggest-tags.dto'

@Injectable()
export class KbService {
  constructor(
    private neo4j: Neo4jService,
    private cache: CacheService,
    private searchSvc: SearchService,
  ) {}

  async push(dto: PushKbDto): Promise<{ id: string; message: string; related_found: number }> {
    const id = uuidv4()
    const now = new Date().toISOString()
    const summary = dto.content.replace(/#+\s/g, '').slice(0, 200)
    const tags = dto.tags ?? []
    const technologies = dto.technologies ?? []

    await this.neo4j.runQuery(
      `CREATE (s:Solution {
        id: $id,
        title: $title,
        content: $content,
        summary: $summary,
        ticket_ref: $ticketRef,
        project: $project,
        created_at: $now,
        updated_at: $now
      })`,
      { id, title: dto.title, content: dto.content, summary, ticketRef: dto.ticket_ref ?? null, project: dto.project ?? null, now },
    )

    // Batch tag creation with UNWIND (single query instead of N)
    if (tags.length > 0) {
      await this.neo4j.runQuery(
        `UNWIND $tags AS tagName
         MERGE (t:Tag { name: tagName })
         WITH t
         MATCH (s:Solution { id: $id })
         MERGE (s)-[:TAGGED_WITH]->(t)`,
        { tags, id },
      )
    }

    if (dto.project) {
      await this.neo4j.runQuery(
        `MERGE (p:Project { name: $project })
         WITH p
         MATCH (s:Solution { id: $id })
         MERGE (s)-[:BELONGS_TO]->(p)`,
        { project: dto.project, id },
      )
    }

    // Batch technology creation with UNWIND (single query instead of N)
    if (technologies.length > 0) {
      await this.neo4j.runQuery(
        `UNWIND $technologies AS techName
         MERGE (t:Technology { name: techName })
         WITH t
         MATCH (s:Solution { id: $id })
         MERGE (s)-[:USES]->(t)`,
        { technologies, id },
      )
    }

    let relatedFound = 0
    if (tags.length > 0) {
      const related = await this.neo4j.runQuery(
        `MATCH (existing:Solution)-[:TAGGED_WITH]->(t:Tag)
         WHERE t.name IN $tags AND existing.id <> $id
         WITH DISTINCT existing
         MATCH (s:Solution { id: $id })
         MERGE (s)-[:RELATED_TO]->(existing)
         RETURN count(existing) AS cnt`,
        { tags, id },
      )
      relatedFound = related.records[0]?.get('cnt')?.toNumber() ?? 0
    }

    await this.searchSvc.indexDocument('solutions', {
      id,
      title: dto.title,
      content: dto.content,
      tags,
      project: dto.project ?? null,
      technologies,
      created_at: now,
    })

    await this.cache.delByPattern('search:*')

    return { id, message: 'Pushed successfully', related_found: relatedFound }
  }

  async search(query: string, limit = 5): Promise<{ results: any[]; total: number; cached: boolean }> {
    const cacheKey = 'search:' + createHash('md5').update(query + limit).digest('hex')
    const cached = await this.cache.get<any>(cacheKey)
    if (cached) return { ...cached, cached: true }

    const { hits, totalHits } = await this.searchSvc.search('solutions', query, { limit })

    const results: any[] = []
    if (hits.length > 0) {
      // Batch fetch all solutions in a single Neo4j query (eliminates N+1)
      const ids = hits.map((h) => h.id)
      const res = await this.neo4j.runQuery(
        `UNWIND $ids AS sid
         MATCH (s:Solution { id: sid })
         OPTIONAL MATCH (s)-[:RELATED_TO]->(rel:Solution)
         RETURN s, collect({ id: rel.id, title: rel.title }) AS related`,
        { ids },
      )

      // Build a map for O(1) lookup by id, preserving Meilisearch rank order
      const byId = new Map<string, any>()
      for (const rec of res.records) {
        const s = rec.get('s').properties
        byId.set(s.id, {
          id: s.id,
          title: s.title,
          summary: s.summary,
          ticket_ref: s.ticket_ref,
          project: s.project,
          created_at: s.created_at,
          related: (rec.get('related') as any[]).filter((r) => r.id),
        })
      }

      // Re-order by Meilisearch rank and attach tags + score from search index
      for (const hit of hits) {
        const node = byId.get(hit.id)
        if (!node) continue
        results.push({
          ...node,
          tags: hit.tags ?? [],
          score: hit._rankingScore ?? 0,
        })
      }
    }

    const payload = { results, total: totalHits }
    await this.cache.set(cacheKey, payload, 300)
    return { ...payload, cached: false }
  }

  async list(opts: { tag?: string; project?: string; page?: number; limit?: number }) {
    const page = opts.page ?? 1
    const limit = opts.limit ?? 20
    const skip = neo4j.int((page - 1) * limit)

    let cypher = `MATCH (s:Solution)`
    const params: any = { skip, limit: neo4j.int(limit) }

    if (opts.tag) {
      cypher = `MATCH (s:Solution)-[:TAGGED_WITH]->(t:Tag { name: $tag })`
      params.tag = opts.tag
    } else if (opts.project) {
      cypher = `MATCH (s:Solution)-[:BELONGS_TO]->(p:Project { name: $project })`
      params.project = opts.project
    }

    const countRes = await this.neo4j.runQuery(cypher + ' RETURN count(s) AS cnt', params)
    const total = countRes.records[0]?.get('cnt')?.toNumber() ?? 0

    const result = await this.neo4j.runQuery(
      cypher + ' RETURN s ORDER BY s.created_at DESC SKIP $skip LIMIT $limit',
      params,
    )

    const items = result.records.map((r) => {
      const s = r.get('s').properties
      return { id: s.id, title: s.title, summary: s.summary, ticket_ref: s.ticket_ref, project: s.project, created_at: s.created_at }
    })

    return { items, total, page, limit }
  }

  async getById(id: string) {
    const result = await this.neo4j.runQuery(
      `MATCH (s:Solution { id: $id })
       OPTIONAL MATCH (s)-[:TAGGED_WITH]->(t:Tag)
       OPTIONAL MATCH (s)-[:USES]->(tech:Technology)
       OPTIONAL MATCH (s)-[:RELATED_TO]->(rel:Solution)
       RETURN s,
         collect(DISTINCT t.name) AS tags,
         collect(DISTINCT tech.name) AS technologies,
         collect(DISTINCT { id: rel.id, title: rel.title }) AS related`,
      { id },
    )
    if (result.records.length === 0) throw new NotFoundException(`Solution ${id} not found`)

    const rec = result.records[0]
    const s = rec.get('s').properties
    return {
      id: s.id,
      title: s.title,
      content: s.content,
      tags: rec.get('tags'),
      ticket_ref: s.ticket_ref,
      project: s.project,
      technologies: rec.get('technologies'),
      created_at: s.created_at,
      updated_at: s.updated_at,
      related: (rec.get('related') as any[]).filter((r) => r.id),
    }
  }

  async update(id: string, dto: UpdateKbDto) {
    const existing = await this.getById(id)
    const now = new Date().toISOString()

    await this.neo4j.runQuery(
      `MATCH (s:Solution { id: $id })
       SET s.title = $title,
           s.content = $content,
           s.summary = $summary,
           s.ticket_ref = $ticketRef,
           s.project = $project,
           s.updated_at = $now`,
      {
        id,
        title: dto.title ?? existing.title,
        content: dto.content ?? existing.content,
        summary: (dto.content ?? existing.content).replace(/#+\s/g, '').slice(0, 200),
        ticketRef: dto.ticket_ref ?? existing.ticket_ref,
        project: dto.project ?? existing.project,
        now,
      },
    )

    await this.searchSvc.updateDocument('solutions', {
      id,
      title: dto.title ?? existing.title,
      content: dto.content ?? existing.content,
      tags: dto.tags ?? existing.tags,
      project: dto.project ?? existing.project,
    })

    await this.cache.delByPattern('search:*')
    return { id, message: 'Updated successfully' }
  }

  async delete(id: string) {
    await this.neo4j.runQuery(
      `MATCH (s:Solution { id: $id }) DETACH DELETE s`,
      { id },
    )
    await this.searchSvc.deleteDocument('solutions', id)
    await this.cache.delByPattern('search:*')
    return { message: 'Deleted successfully' }
  }

  async suggestTags(content: string, project?: string): Promise<SuggestedTagDto[]> {
    // 1. Extract keywords from content (heuristic)
    const keywords = this.extractKeywords(content)
    if (keywords.length === 0) return []

    // 2. Query Meilisearch for similar solutions
    const { hits } = await this.searchSvc.search('solutions', keywords.join(' '), { limit: 10 })

    // 3. Aggregate tags from similar solutions (frequency-based)
    const tagFrequency = new Map<string, number>()
    for (const hit of hits) {
      const tags = (hit.tags as string[]) ?? []
      for (const tag of tags) {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1)
      }
    }

    // 4. Query graph for related tags (co-occurrence patterns)
    const graphTags = await this.getRelatedTagsByGraph(keywords)

    // 5. Merge and rank by confidence
    const suggested = this.rankTagSuggestions(tagFrequency, graphTags, keywords, project)

    // 6. Return top 10 with confidence scores
    return suggested.slice(0, 10)
  }

  private extractKeywords(content: string): string[] {
    // Remove common words, extract meaningful terms
    const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'be', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'that', 'this', 'it', 'have', 'has', 'do', 'does', 'did', 'can', 'could', 'would', 'should'])
    const words = content.toLowerCase().match(/\b\w+\b/g) || []

    return words
      .filter((w) => w.length > 3 && !stopwords.has(w))
      .slice(0, 10)
  }

  private async getRelatedTagsByGraph(keywords: string[]): Promise<Map<string, number>> {
    const tagMap = new Map<string, number>()

    // For each keyword, find tags that co-occur frequently in the graph
    for (const keyword of keywords) {
      const result = await this.neo4j.runQuery(
        `
        MATCH (t:Tag { name: $keyword })<-[:TAGGED_WITH]-(s:Solution)
              -[:TAGGED_WITH]->(related:Tag)
        WHERE related.name <> $keyword
        RETURN related.name AS name, count(DISTINCT s) AS cnt
        ORDER BY cnt DESC
        LIMIT 5
        `,
        { keyword },
      )

      for (const record of result.records) {
        const name = record.get('name')
        const cnt = record.get('cnt').toNumber()
        tagMap.set(name, (tagMap.get(name) || 0) + cnt)
      }
    }

    return tagMap
  }

  private rankTagSuggestions(
    frequency: Map<string, number>,
    graphTags: Map<string, number>,
    keywords: string[],
    project?: string,
  ): SuggestedTagDto[] {
    const scored = new Map<string, SuggestedTagDto>()

    // Score from frequency (0-1, weighted by occurrences)
    frequency.forEach((count, tag) => {
      const confidence = Math.min(count / 5, 1.0) * 0.6 // Weight frequency at 60%
      scored.set(tag, {
        tag,
        confidence,
        reason: 'frequency',
        relatedSolutions: count,
      })
    })

    // Score from graph patterns (co-occurrence)
    graphTags.forEach((count, tag) => {
      if (scored.has(tag)) {
        const existing = scored.get(tag)!
        existing.confidence = Math.max(existing.confidence, (Math.min(count / 10, 1.0) * 0.4))
      } else {
        scored.set(tag, {
          tag,
          confidence: Math.min(count / 10, 1.0) * 0.4, // Weight graph at 40%
          reason: 'graph',
          relatedSolutions: 0,
        })
      }
    })

    // Boost keyword matches (direct content match)
    keywords.forEach((keyword) => {
      if (scored.has(keyword)) {
        const existing = scored.get(keyword)!
        existing.confidence = Math.min(existing.confidence + 0.3, 1.0)
        existing.reason = 'content_match'
      }
    })

    // Filter low-confidence, sort by confidence (descending)
    return Array.from(scored.values())
      .filter((t) => t.confidence > 0.2)
      .sort((a, b) => b.confidence - a.confidence)
  }
}
