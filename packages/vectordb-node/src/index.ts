/**
 * 公开门面：VectorDB 与 Collection。
 *
 * 这一层只做三件事：把 JS 形状（Point/SearchHit/选项）翻成协议参数、把载荷里的向量还原成 Float32Array、
 * 把 sidecar 的错误码原样抛成 VectorDBError。
 */

import { SidecarClient, type SidecarOptions } from "./client.js";
import { VectorDBError, packVectors, unpackVectors } from "./protocol.js";

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
