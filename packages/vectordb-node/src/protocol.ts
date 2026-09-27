/**
 * 协议层：帧格式、载荷打包、类型与错误码。
 *
 * 帧格式（小端）：
 *   [u32 总长][u32 头长][JSON 头][二进制载荷]
 * 总长 = 4 + 头长 + 载荷长；向量走载荷（float32、行主序），不进 JSON。
 */

export const PROTOCOL_VERSION = 1;

/** 载荷里的一个向量块：从载荷第 offset 字节起，count 行、每行 dimension 个 float32。 */
export interface VectorBlock {
  offset: number;
  count: number;
  dimension: number;
}

/** 请求与响应共用一个信封。 */
export interface Envelope {
  id?: number;
  method?: string;
  params?: unknown;
  vectors?: VectorBlock[];
  ok?: boolean;
  result?: unknown;
  error?: RpcError;
  outVectors?: VectorBlock[];
  event?: ProgressEvent;
}

export interface RpcError {
  code: string;
  message: string;
}

export interface ProgressEvent {
  kind: string;
  id: number;
  stage: string;
  completed: number;
  total: number;
}

/** 服务端回的稳定错误码（由 Go 侧的哨兵错误映射而来）。 */
export type ErrorCode =
  | "invalid_argument"
  | "unknown_method"
  | "collection_not_found"
  | "database_locked"
  | "database_closed"
  | "collection_closed"
  | "collection_busy"
  | "read_only"
  | "recovery_required"
  | "format_incompatible"
  | "storage_corrupted"
  | "persistence_failed"
  | "unsupported_engine"
  | "needs_initial_points"
  | "dimension_invalid"
  | "point_id_invalid"
  | "capacity_exceeded"
  | "vector_value_invalid"
  | "metric_unsupported"
  | "cancelled"
  | "timeout"
  | "internal"
  | "sidecar_exited"
  | "sidecar_unavailable";

export class VectorDBError extends Error {
  readonly code: ErrorCode | string;
  readonly method?: string;

  constructor(code: ErrorCode | string, message: string, method?: string) {
    super(message);
    this.name = "VectorDBError";
    this.code = code;
    this.method = method;
  }
}

export interface Frame {
  header: Envelope;
  payload: Buffer;
}

/** 增量帧解码器：喂进 stdout 分片，吐出完整帧。 */
export class FrameDecoder {
  private buffer: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): Frame[] {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    const frames: Frame[] = [];
    for (;;) {
      if (this.buffer.length < 4) break;
      const total = this.buffer.readUInt32LE(0);
      if (this.buffer.length < 4 + total) break;
      const headerLength = this.buffer.readUInt32LE(4);
      const headerText = this.buffer.subarray(8, 8 + headerLength).toString("utf8");
      const payload = this.buffer.subarray(8 + headerLength, 4 + total);
      this.buffer = this.buffer.subarray(4 + total);
      frames.push({ header: JSON.parse(headerText) as Envelope, payload: Buffer.from(payload) });
    }
    return frames;
  }
}

/** 把一批等长向量打成一个载荷块（行主序 float32）。 */
export function packVectors(rows: readonly (Float32Array | readonly number[])[]): {
  blocks: VectorBlock[];
  payload: Buffer;
} {
  if (rows.length === 0) return { blocks: [], payload: Buffer.alloc(0) };
  const dimension = rows[0].length;
  const flat = new Float32Array(rows.length * dimension);
  rows.forEach((row, index) => {
    const offset = index * dimension;
    if (row.length !== dimension) {
      throw new VectorDBError("invalid_argument", `向量维度不一致：第 0 行 ${dimension}，第 ${index} 行 ${row.length}`);
    }
    flat.set(row as ArrayLike<number>, offset);
  });
  return {
    blocks: [{ offset: 0, count: rows.length, dimension }],
    payload: Buffer.from(flat.buffer, flat.byteOffset, flat.byteLength),
  };
}

/** 按块把载荷切回向量（每块合成一个 Float32Array）。 */
export function unpackVectors(payload: Buffer, blocks: readonly VectorBlock[] | undefined): Float32Array[] {
  if (blocks === undefined || blocks.length === 0) return [];
  return blocks.map((block, index) => {
    const bytes = block.count * block.dimension * 4;
    if (block.offset < 0 || block.offset + bytes > payload.length) {
      throw new VectorDBError(
        "internal",
        `第 ${index} 个向量块越界：需要 ${bytes} 字节，载荷 ${payload.length} 字节`,
      );
    }
    const slice = payload.subarray(block.offset, block.offset + bytes);
    const copy = new Float32Array(slice.byteLength / 4);
    Buffer.from(copy.buffer, copy.byteOffset, copy.byteLength).set(slice);
    return copy;
  });
}

export function encodeFrame(header: Envelope, payload: Buffer = Buffer.alloc(0)): Buffer {
  const headerBuffer = Buffer.from(JSON.stringify(header), "utf8");
  const head = Buffer.alloc(8);
  head.writeUInt32LE(4 + headerBuffer.length + payload.length, 0);
  head.writeUInt32LE(headerBuffer.length, 4);
  return payload.length === 0
    ? Buffer.concat([head, headerBuffer])
    : Buffer.concat([head, headerBuffer, payload]);
}
