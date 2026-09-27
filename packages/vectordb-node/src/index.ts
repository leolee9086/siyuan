/**
 * 公开门面：VectorDB 与 Collection。
 *
 * 这一层只做三件事：把 JS 形状（Point/SearchHit/选项）翻成协议参数、把载荷里的向量还原成 Float32Array、
 * 把 sidecar 的错误码原样抛成 VectorDBError。
 */

import { SidecarClient, type SidecarOptions } from "./client.js";
import { VectorDBError, packNamedVectors, packVectors, unpackNamedVectors, unpackVectors } from "./protocol.js";

export * from "./protocol.js";
export { SidecarClient, resolveSidecarBinary } from "./client.js";
export type { SidecarOptions } from "./client.js";

export type Engine = "disk-vamana" | "hnsw";
export type Durability = "memory" | "async" | "sync";
export type DistanceMetric = "l2" | "cosine" | "ip";

export interface CollectionStats {
  name: string;
  engine: Engine;
  dimension: number;
  /** 存活条数（不含墓碑）。 */
  count: number;
  totalCount?: number;
  deletedCount?: number;
  pendingCount?: number;
  walBytes?: number;
  checkpointRecommended?: boolean;
  activeGeneration?: string;
  maintenanceError?: string;
}

export interface WriteResult {
  commitSequence: number;
  applied: number;
  durability: Durability;
  committed: boolean;
  indexHealthy: boolean;
}

export interface CheckpointResult {
  engine: Engine;
  commitSequence: number;
  originalPoints: number;
  remainingPoints: number;
  reclaimedPoints: number;
  walBytesBefore: number;
  cleanupPending: boolean;
}

export interface SearchHit {
  id: string;
  score: number;
  distance: number;
  meta?: unknown;
}

/** 写入用的点：向量既收 Float32Array 也收普通数字数组。 */
export interface VectorInput {
  id: string;
  vector: Float32Array | readonly number[];
  meta?: unknown;
}

/** 取回的存点：向量来自载荷，因此一定是 Float32Array。 */
export interface StoredPoint {
  id: string;
  vector: Float32Array;
  meta?: unknown;
}

export interface DiskBuildOptions {
  numWorkers?: number;
  chunkSize?: number;
  blockSize?: number;
  writeBufferSize?: number;
  /** 是否启用 BBQ 量化；缺省由引擎按维度决定（dim ≥ 64 自动启用）。 */
  enableBBQ?: boolean;
}

export interface CreateCollectionOptions {
  engine?: Engine;
  dimension: number;
  distanceMetric?: DistanceMetric;
  meta?: Record<string, unknown>;
  walCheckpointBytes?: number;
  diskBuild?: DiskBuildOptions;
  /** DiskVamana 建库必须带初始点集（引擎用它构建磁盘图）。 */
  initialPoints?: VectorInput[];
}


/** 一个命名嵌入字段的契约：维度与距离度量在建库时定死。 */
export interface EmbeddingSchema {
  dimension: number;
  distanceMetric?: DistanceMetric;
}

/** 把一个嵌入字段投影到一个独立 ANN 引擎（IndexView）。 */
export interface IndexViewOptions {
  embedding: string;
  engine?: Engine;
}

/** 数据集里的一个实体：共享 ID 与 meta，带多个**命名**嵌入。
 *
 *  多个命名嵌入是「换嵌入模型不炸库」的实现方式：换模型 = 加一个字段，
 *  旧字段原样留着，旧记忆后台渐进回填，迁移期两路并存靠 RRF 融合。
 */
export interface EntityInput {
  id: string;
  embeddings: Record<string, Float32Array | readonly number[]>;
  meta?: unknown;
}

/** 取回的实体：向量是按字段名索引的一维数组（长度 = 实体数 × 维度）。 */
export interface StoredEntity {
  id: string;
  embeddings: Record<string, Float32Array>;
  meta?: unknown;
}

export interface DatasetStats {
  name: string;
  entityCount?: number;
  embeddings?: Record<string, EmbeddingSchema>;
  indexes?: readonly string[];
  [key: string]: unknown;
}

/** 融合检索的一路：查哪个索引、用哪个向量、占多少权重。 */
export interface FusionQuery {
  index: string;
  vector: Float32Array | readonly number[];
  weight?: number;
  topK?: number;
  efSearch?: number;
}

/** 融合结果里的一路来源 —— 它会告诉你这条是靠哪个字段、排在第几被捞上来的。 */
export interface FusionSource {
  index: string;
  embedding: string;
  rank: number;
  score: number;
  distance: number;
  weight: number;
}

export interface FusedSearchResult {
  id: string;
  score: number;
  meta?: unknown;
  sources?: readonly FusionSource[];
}

export interface FusionFailure {
  index: string;
  error: string;
}

export interface FusionSearchResponse {
  results: FusedSearchResult[];
  failures?: readonly FusionFailure[];
}

export interface CreateDatasetOptions {
  embeddings: Record<string, EmbeddingSchema>;
  indexes?: Record<string, IndexViewOptions>;
  entities?: readonly EntityInput[];
}

export interface SearchOptions {
  topK?: number;
  efSearch?: number;
  scoreThreshold?: number;
  excludeIds?: string[];
  groupBy?: string;
  maxPerGroup?: number;
  candidateMultiplier?: number;
  timeoutMs?: number;
}

export interface WriteOptions {
  durability?: Durability;
  timeoutMs?: number;
}

/**
 * 元数据在协议里按**原样的 JSON 值**走（不是 JSON 文本）：发出去是这个值，收回来还是这个值。
 * 为兼容手写协议里可能出现的 JSON 文本，这里对字符串再做一次尝试性解析。
 */
function normalizeMeta(meta: unknown): unknown {
  if (meta === undefined || meta === null) return undefined;
  if (typeof meta !== "string") return meta;
  if (meta === "") return undefined;
  try {
    return JSON.parse(meta);
  } catch {
    return meta;
  }
}

export class Collection {
  constructor(
    private readonly client: SidecarClient,
    readonly name: string,
    private readonly known: CollectionStats,
  ) {}

  get engine(): Engine {
    return this.known.engine;
  }

  get dimension(): number {
    return this.known.dimension;
  }

  /**
   * 批量写入（走带提交序号与进度事件的写入契约）。
   * 这里给每个点打一个单行向量块，操作的 vectorIndex 直接指向自己的那一行。
   */
  async write(points: readonly VectorInput[], options: WriteOptions = {}): Promise<WriteResult> {
    const { payload } = packVectors(points.map((point) => point.vector));
    const rowBlocks = points.map((point, index) => ({
      offset: index * point.vector.length * 4,
      count: 1,
      dimension: point.vector.length,
    }));
    const operations = points.map((point, index) => {
      const operation: Record<string, unknown> = { id: point.id, vectorIndex: index };
      if (point.meta !== undefined) operation.meta = point.meta;
      return operation;
    });
    const { result } = await this.client.request<WriteResult>(
      "collection.write",
      {
        collection: this.name,
        durability: options.durability ?? "sync",
        timeoutMs: options.timeoutMs ?? 0,
        operations,
      },
      payload,
      rowBlocks,
    );
    return result;
  }

  /** 单点或批量 upsert（无提交序号语义；需要序号请用 write）。 */
  async upsert(points: readonly VectorInput[]): Promise<void> {
    // 多行必须打成一个块：服务端按 ids 在该块内切行。
    const { payload, blocks } = packVectors(points.map((point) => point.vector));
    const metas = points.map((point) => point.meta ?? null);
    await this.client.request(
      "collection.upsert",
      { collection: this.name, vectorIndex: 0, ids: points.map((point) => point.id), metas },
      payload,
      blocks,
    );
  }

  async delete(ids: readonly string[]): Promise<void> {
    await this.client.request("collection.delete", { collection: this.name, ids: [...ids] });
  }

  async search(vector: Float32Array | readonly number[], options: SearchOptions = {}): Promise<SearchHit[]> {
    const { payload, blocks } = packVectors([vector]);
    const { result } = await this.client.request<SearchHit[]>(
      "collection.search",
      {
        collection: this.name,
        topK: options.topK ?? 10,
        efSearch: options.efSearch ?? 0,
        scoreThreshold: options.scoreThreshold ?? 0,
        excludeIds: options.excludeIds ?? [],
        groupBy: options.groupBy ?? "",
        maxPerGroup: options.maxPerGroup ?? 0,
        candidateMultiplier: options.candidateMultiplier ?? 0,
        timeoutMs: options.timeoutMs ?? 0,
      },
      payload,
      blocks,
    );
    return (result ?? []).map((hit) => ({ ...hit, meta: normalizeMeta(hit.meta) }));
  }

  /** 取点：向量随载荷回来；注意 cosine 集合存的是单位化后的向量。 */
  async fetchPoints(ids: readonly string[]): Promise<StoredPoint[]> {
    const { result, payload, outVectors } = await this.client.request<{ points: { id: string; meta?: unknown }[] }>(
      "collection.fetchPoints",
      { collection: this.name, ids: [...ids] },
    );
    const vectors = unpackVectors(payload, outVectors);
    const flat = vectors[0];
    const dimension = outVectors[0]?.dimension ?? 0;
    return (result?.points ?? []).map((point, index) => ({
      id: point.id,
      vector: dimension > 0 && flat !== undefined ? flat.subarray(index * dimension, (index + 1) * dimension) : new Float32Array(0),
      meta: normalizeMeta(point.meta),
    }));
  }

  async flush(): Promise<void> {
    await this.client.request("collection.flush", { collection: this.name });
  }

  async checkpoint(options: { timeoutMs?: number } = {}): Promise<CheckpointResult> {
    const { result } = await this.client.request<CheckpointResult>("collection.checkpoint", {
      collection: this.name,
      timeoutMs: options.timeoutMs ?? 0,
    });
    return result;
  }

  async stats(): Promise<CollectionStats> {
    const { result } = await this.client.request<CollectionStats>("collection.stats", { collection: this.name });
    return result;
  }
}


/**
 * 数据集句柄：多命名嵌入 + 多索引视图 + RRF 融合检索。
 *
 * 与 {@link Collection} 的区别只有一处，但是要紧的一处：**一个实体可以有多个嵌入字段**。
 * 于是「换嵌入模型」不再是重刷全库，而是加一个字段、两路并存、按权重融合。
 */
export class Dataset {
  constructor(
    private readonly client: SidecarClient,
    readonly name: string,
  ) {}

  async stats(): Promise<DatasetStats> {
    const { result } = await this.client.request<DatasetStats>("dataset.stats", { dataset: this.name });
    return result;
  }

  async listIndexes(): Promise<unknown[]> {
    const { result } = await this.client.request<unknown[]>("dataset.listIndexes", { dataset: this.name });
    return result ?? [];
  }

  /**
   * 写入/更新实体。向量按字段打包成若干命名块 —— 服务端靠块名对齐字段，
   * 不靠位置，所以字段顺序在两边都可以不一样。
   */
  async upsertEntities(entities: readonly EntityInput[], options: WriteOptions = {}): Promise<unknown> {
    if (entities.length === 0) return { applied: 0 };
    const fields: Record<string, (Float32Array | readonly number[])[]> = {};
    for (const entity of entities) {
      for (const [field, vector] of Object.entries(entity.embeddings)) {
        (fields[field] ??= []).push(vector);
      }
    }
    // 每个字段的行数必须等于实体数 —— 少一行就意味着字段与实体错位，宁可在客户端拦住。
    for (const [field, rows] of Object.entries(fields)) {
      if (rows.length !== entities.length) {
        throw new VectorDBError("invalid_argument",
          `字段 ${field} 只有 ${rows.length} 个向量，但实体有 ${entities.length} 个`);
      }
    }
    const { blocks, payload } = packNamedVectors(fields);
    const { result } = await this.client.request(
      "dataset.upsertEntities",
      {
        dataset: this.name,
        ids: entities.map((entity) => entity.id),
        metas: entities.map((entity) => entity.meta ?? null),
        durability: options.durability ?? "sync",
      },
      payload,
      blocks,
    );
    return result;
  }

  async deleteEntities(ids: readonly string[], options: WriteOptions = {}): Promise<unknown> {
    const { result } = await this.client.request("dataset.deleteEntities", {
      dataset: this.name,
      ids: [...ids],
      durability: options.durability ?? "sync",
    });
    return result;
  }

  /** 单索引检索：只在某一个嵌入字段的索引视图中查。 */
  async search(index: string, vector: Float32Array | readonly number[], options: SearchOptions = {}): Promise<SearchHit[]> {
    const { payload, blocks } = packVectors([vector]);
    const { result } = await this.client.request<SearchHit[]>(
      "dataset.search",
      {
        dataset: this.name,
        index,
        vectorIndex: 0,
        topK: options.topK ?? 10,
        efSearch: options.efSearch ?? 0,
        scoreThreshold: options.scoreThreshold ?? 0,
        excludeIds: options.excludeIds ?? [],
      },
      payload,
      blocks,
    );
    return (result ?? []).map((hit) => ({ ...hit, meta: normalizeMeta(hit.meta) }));
  }

  /**
   * **RRF 融合检索**：多路各查一次，按排名（不是分数）融合。
   *
   * 按排名融合是要紧的：不同嵌入字段、不同引擎、甚至不同量纲的打分本来就没法直接比，
   * RRF 只取「排第几」，天然绕开归一化。
   *
   * @param queries 参与融合的每一路（索引名 + 查询向量 + 可选权重）。
   * @param options topK / rrfConstant / allowPartial —— 后者为真时某一路失败不拖垮整体，
   *   失败明细在响应的 failures 里。
   */
  async fuseSearch(queries: readonly FusionQuery[], options: { topK?: number; rrfConstant?: number; allowPartial?: boolean } = {}): Promise<FusionSearchResponse> {
    if (queries.length === 0) return { results: [] };
    // 每路打一个**单行块**，vectorIndex 指向自己那一块 —— 服务端按块下标取向量，
    // 打成一个大块（多行）的话它只会看到 1 个块。collection.write 也是这么打的。
    const rows = queries.map((query) => query.vector);
    const { payload } = packVectors(rows);
    const rowBlocks = rows.map((row, index) => ({
      offset: index * row.length * 4,
      count: 1,
      dimension: row.length,
    }));
    const { result } = await this.client.request<FusionSearchResponse>(
      "dataset.fuseSearch",
      {
        dataset: this.name,
        topK: options.topK ?? 10,
        rrfConstant: options.rrfConstant ?? 0,
        allowPartial: options.allowPartial ?? false,
        queries: queries.map((query, index) => ({
          index: query.index,
          vectorIndex: index,
          weight: query.weight ?? 1,
          topK: query.topK ?? 0,
          efSearch: query.efSearch ?? 0,
        })),
      },
      payload,
      rowBlocks,
    );
    const response = result ?? { results: [] };
    return {
      results: (response.results ?? []).map((item) => ({ ...item, meta: normalizeMeta(item.meta) })),
      ...(response.failures === undefined ? {} : { failures: response.failures }),
    };
  }

  /** 取回实体：每个嵌入字段一块，靠块名对回字段。 */
  async fetchEntities(ids: readonly string[]): Promise<StoredEntity[]> {
    const { result, payload, outVectors } = await this.client.request<{
      entities: { id: string; embeddings?: string[]; meta?: unknown }[];
    }>("dataset.fetchEntities", { dataset: this.name, ids: [...ids] });
    const named = unpackNamedVectors(payload, outVectors);
    return (result?.entities ?? []).map((entity) => {
      const embeddings: Record<string, Float32Array> = {};
      for (const field of entity.embeddings ?? []) {
        const flat = named.get(field);
        if (flat === undefined) continue;
        // 一行一个实体：按本次返回的实体数切。
        const count = (result?.entities ?? []).length;
        const dimension = count > 0 ? flat.length / count : 0;
        const index = (result?.entities ?? []).findIndex((item) => item.id === entity.id);
        embeddings[field] = dimension > 0 && index >= 0
          ? flat.subarray(index * dimension, (index + 1) * dimension)
          : new Float32Array(0);
      }
      return { id: entity.id, embeddings, meta: normalizeMeta(entity.meta) };
    });
  }

  async addIndex(name: string, options: IndexViewOptions): Promise<void> {
    await this.client.request("dataset.addIndex", {
      dataset: this.name,
      name,
      options: { embedding: options.embedding, engine: options.engine ?? "hnsw" },
    });
  }

  async dropIndex(name: string): Promise<void> {
    await this.client.request("dataset.dropIndex", { dataset: this.name, name });
  }

  async checkpoint(): Promise<void> {
    await this.client.request("dataset.checkpoint", { dataset: this.name });
  }
}

export class VectorDB {
  private closed = false;

  private constructor(
    private readonly client: SidecarClient,
    readonly path: string,
  ) {}

  /** 打开（或创建）数据库目录；sidecar 进程此时才被拉起。 */
  static async open(options: { path: string } & SidecarOptions): Promise<VectorDB> {
    if (options.path === undefined || options.path === "") {
      throw new VectorDBError("invalid_argument", "openVectorDB 需要 path");
    }
    const client = new SidecarClient(options);
    const db = new VectorDB(client, options.path);
    await client.request("db.open", { path: options.path });
    return db;
  }

  get pid(): number | undefined {
    return this.client.pid;
  }

  on(event: "progress", handler: Parameters<SidecarClient["on"]>[1]): () => void {
    return this.client.on(event, handler);
  }

  async ping(): Promise<{ pong: boolean; protocolVersion: number }> {
    const { result } = await this.client.request<{ pong: boolean; protocolVersion: number }>("ping", {});
    return result;
  }

  async listCollections(): Promise<CollectionStats[]> {
    const { result } = await this.client.request<CollectionStats[]>("db.listCollections", {});
    return result ?? [];
  }

  /** 建集合。DiskVamana 需要 initialPoints（引擎用它们构建磁盘图）。 */
  async createCollection(name: string, options: CreateCollectionOptions): Promise<Collection> {
    const engine: Engine = options.engine ?? "disk-vamana";
    const initial = options.initialPoints ?? [];
    if (engine === "disk-vamana" && initial.length === 0) {
      throw new VectorDBError(
        "needs_initial_points",
        "DiskVamana 建库必须带初始点集：请传 initialPoints（引擎用它构建磁盘图）",
      );
    }
    const packed = initial.length > 0 ? packVectors(initial.map((point) => point.vector)) : { payload: Buffer.alloc(0), blocks: [] };
    const params: Record<string, unknown> = {
      name,
      engine,
      dimension: options.dimension,
      distanceMetric: options.distanceMetric ?? "",
      walCheckpointBytes: options.walCheckpointBytes ?? 0,
    };
    if (options.meta !== undefined) params.meta = options.meta;
    if (options.diskBuild !== undefined) params.diskBuildConfig = options.diskBuild;
    if (initial.length > 0) {
      params.initialIds = initial.map((point) => point.id);
      params.initialMetas = initial.map((point) => point.meta ?? null);
      params.vectorIndex = 0;
    }
    const { result } = await this.client.request<CollectionStats>("db.createCollection", params, packed.payload, packed.blocks);
    return new Collection(this.client, name, result);
  }

  async openCollection(name: string): Promise<Collection> {
    const { result } = await this.client.request<CollectionStats>("db.openCollection", { name });
    return new Collection(this.client, name, result);
  }

  async deleteCollection(name: string): Promise<void> {
    await this.client.request("db.deleteCollection", { name });
  }

  // ---- 数据集（多命名嵌入 + RRF 融合）----

  async listDatasets(): Promise<DatasetStats[]> {
    const { result } = await this.client.request<DatasetStats[]>("db.listDatasets", {});
    return result ?? [];
  }

  /**
   * 建数据集。embeddings 声明有哪些命名嵌入字段（各自的维度与度量），
   * indexes 决定每个字段投影到哪个 ANN 引擎 —— 不写索引名也行，之后用 addIndex 补。
   */
  async createDataset(name: string, options: CreateDatasetOptions): Promise<Dataset> {
    const params: Record<string, unknown> = {
      name,
      embeddings: Object.fromEntries(Object.entries(options.embeddings).map(([field, schema]) => [
        field,
        { dimension: schema.dimension, distanceMetric: schema.distanceMetric ?? "" },
      ])),
      indexes: Object.fromEntries(Object.entries(options.indexes ?? {}).map(([index, view]) => [
        index,
        { embedding: view.embedding, engine: view.engine ?? "hnsw" },
      ])),
    };
    const entities = options.entities ?? [];
    const fields: Record<string, (Float32Array | readonly number[])[]> = {};
    for (const entity of entities) {
      for (const [field, vector] of Object.entries(entity.embeddings)) {
        (fields[field] ??= []).push(vector);
      }
    }
    const packed = entities.length > 0 ? packNamedVectors(fields) : packNamedVectors({});
    if (entities.length > 0) {
      params.ids = entities.map((entity) => entity.id);
      params.metas = entities.map((entity) => entity.meta ?? null);
    }
    await this.client.request("db.createDataset", params, packed.payload, packed.blocks);
    return new Dataset(this.client, name);
  }

  async openDataset(name: string): Promise<Dataset> {
    await this.client.request("db.openDataset", { name });
    return new Dataset(this.client, name);
  }

  async deleteDataset(name: string): Promise<void> {
    await this.client.request("db.deleteDataset", { name });
  }

  /** 关闭：先关库再收进程。可重复调用。 */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.client.request("db.close", {});
    } finally {
      await this.client.close();
    }
  }
}

export async function openVectorDB(options: { path: string } & SidecarOptions): Promise<VectorDB> {
  return VectorDB.open(options);
}
