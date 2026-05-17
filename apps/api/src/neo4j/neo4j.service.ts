import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import neo4j, { Driver, Session, QueryResult } from 'neo4j-driver'

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name)
  private driver: Driver

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.driver = neo4j.driver(
      this.config.get<string>('NEO4J_URI'),
      neo4j.auth.basic(
        this.config.get<string>('NEO4J_USER'),
        this.config.get<string>('NEO4J_PASSWORD'),
      ),
    )
    await this.driver.verifyConnectivity()
    this.logger.log('Neo4j connected')
    await this.createConstraints()
  }

  private async createConstraints() {
    const constraints = [
      'CREATE CONSTRAINT apikey_id IF NOT EXISTS FOR (k:ApiKey) REQUIRE k.id IS UNIQUE',
      'CREATE CONSTRAINT solution_id IF NOT EXISTS FOR (s:Solution) REQUIRE s.id IS UNIQUE',
      'CREATE CONSTRAINT solution_revision_id IF NOT EXISTS FOR (r:SolutionRevision) REQUIRE r.id IS UNIQUE',
      'CREATE CONSTRAINT tag_name IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE',
      'CREATE CONSTRAINT project_name IF NOT EXISTS FOR (p:Project) REQUIRE p.name IS UNIQUE',
      'CREATE CONSTRAINT tech_name IF NOT EXISTS FOR (t:Technology) REQUIRE t.name IS UNIQUE',
      'CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE',
      'CREATE CONSTRAINT aitool_name IF NOT EXISTS FOR (t:AITool) REQUIRE t.name IS UNIQUE',
    ]
    // Index on key_prefix enables O(1) lookup in validateKey (without this, prefix query is still O(n))
    const indexes = [
      'CREATE INDEX apikey_prefix IF NOT EXISTS FOR (k:ApiKey) ON (k.key_prefix)',
      'CREATE INDEX solution_project IF NOT EXISTS FOR (s:Solution) ON (s.project)',
      'CREATE INDEX solution_created IF NOT EXISTS FOR (s:Solution) ON (s.created_at)',
      'CREATE INDEX solution_revision_solution IF NOT EXISTS FOR (r:SolutionRevision) ON (r.solution_id)',
      'CREATE INDEX solution_revision_version IF NOT EXISTS FOR (r:SolutionRevision) ON (r.version)',
    ]
    for (const c of [...constraints, ...indexes]) {
      await this.runQuery(c)
    }
    this.logger.log('Neo4j constraints and indexes ready')
  }

  async onModuleDestroy() {
    await this.driver.close()
  }

  async runQuery(cypher: string, params: Record<string, any> = {}): Promise<QueryResult> {
    const session: Session = this.driver.session()
    try {
      return await session.run(cypher, params)
    } finally {
      await session.close()
    }
  }

  toPlain(record: any): Record<string, any> {
    const obj: Record<string, any> = {}
    for (const key of record.keys) {
      const val = record.get(key)
      obj[key] = val?.properties ?? val
    }
    return obj
  }
}
