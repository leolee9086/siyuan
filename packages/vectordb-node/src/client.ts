/**
 * sidecar 进程客户端：拉起可执行文件、按帧收发、管理生命周期。
 *
 * 约定：
 *   - stdout 是协议专用；子进程的日志走 stderr（本客户端收下来交给 onLog，或丢弃）。
 *   - 一个请求一个响应；写入期间服务端会穿插进度事件，事件不占用响应位，交给 on("progress")。
 *   - 子进程意外退出时，所有在飞请求立刻以 sidecar_exited 拒绝，并（默认）在下次请求时重新拉起。
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FrameDecoder,
  VectorDBError,
  encodeFrame,
  type Envelope,
  type ProgressEvent,
  type RpcError,
  type VectorBlock,
} from "./protocol.js";

export interface SidecarOptions {
  /** sidecar 可执行文件路径；缺省按平台查找包内 bin/，也认环境变量 VECTORDB_SIDECAR。 */
  binary?: string;
  cwd?: string;
  env?: Record<string, string>;
  /** 子进程 stderr 的每一行（默认丢弃）。 */
  onLog?: (line: string) => void;
  /** 单个请求的默认超时（毫秒）；0 或缺省表示不超时（大写入可能很久）。 */
  requestTimeoutMs?: number;
  /** 子进程意外退出后，下次请求是否自动重新拉起（默认 true）。 */
  autoRestart?: boolean;
}

export interface RpcResult<T> {
  result: T;
  payload: Buffer;
  outVectors: VectorBlock[];
}

interface Pending {
  method: string;
  resolve: (value: { header: Envelope; payload: Buffer }) => void;
  reject: (error: Error) => void;
  timer?: NodeJS.Timeout;
}

/** 默认按平台找包内 bin/ 下的产物；可用环境变量或 binary 选项覆盖。 */
export function resolveSidecarBinary(explicit?: string): string {
  if (explicit !== undefined && explicit !== "") return explicit;
  const fromEnv = process.env.VECTORDB_SIDECAR;
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/ 与 src/ 同在包内，bin/ 在包根：两种深度都试一遍。
  const suffix = process.platform === "win32" ? ".exe" : "";
  const candidates = [
    join(here, "..", "bin", `vectordb-sidecar${suffix}`),
    join(here, "..", "..", "bin", `vectordb-sidecar${suffix}`),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new VectorDBError(
    "sidecar_unavailable",
    `找不到 sidecar 可执行文件，试过：${candidates.join("、")}；先跑 node scripts/build-sidecar.mjs，或用 binary 选项指定`,
  );
}

export class SidecarClient {
  private child: ChildProcessWithoutNullStreams | undefined;
  private readonly decoder = new FrameDecoder();
  private readonly pending = new Map<number, Pending>();
  private readonly progressHandlers: ((event: ProgressEvent) => void)[] = [];
  private nextId = 1;
  private closing = false;
  private started = false;
  private readonly binary: string;

  constructor(private readonly options: SidecarOptions = {}) {
    this.binary = resolveSidecarBinary(options.binary);
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  get binaryPath(): string {
    return this.binary;
  }

  on(event: "progress", handler: (event: ProgressEvent) => void): () => void {
    if (event !== "progress") throw new VectorDBError("invalid_argument", `未知事件 ${String(event)}`);
    this.progressHandlers.push(handler);
    return () => {
      const index = this.progressHandlers.indexOf(handler);
      if (index >= 0) this.progressHandlers.splice(index, 1);
    };
  }

  ensureStarted(): void {
    if (this.child !== undefined) return;
    this.closing = false;
    const child = spawn(this.binary, [], {
      cwd: this.options.cwd,
      env: this.options.env === undefined ? process.env : { ...process.env, ...this.options.env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    this.started = true;
    child.stdout.on("data", (chunk: Buffer) => this.handleChunk(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      const onLog = this.options.onLog;
      if (onLog === undefined) return;
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim() !== "") onLog(line);
      }
    });
    child.on("error", (error) => this.failAll(new VectorDBError("sidecar_unavailable", error.message)));
    child.on("exit", (code, signal) => {
      this.child = undefined;
      const reason = this.closing ? "客户端已关闭" : `sidecar 退出（code=${String(code)} signal=${String(signal)}）`;
      this.failAll(new VectorDBError("sidecar_exited", reason));
      if (!this.closing && this.options.autoRestart !== false) {
        // 下一次请求会通过 ensureStarted() 重新拉起；这里不主动重启，避免静默循环。
      }
    });
  }

  private handleChunk(chunk: Buffer): void {
    for (const frame of this.decoder.push(chunk)) {
      if (frame.header.event !== undefined) {
        for (const handler of this.progressHandlers) handler(frame.header.event);
        continue;
      }
      const id = frame.header.id;
      if (id === undefined) continue;
      const waiter = this.pending.get(id);
      if (waiter === undefined) continue;
      this.pending.delete(id);
      if (waiter.timer !== undefined) clearTimeout(waiter.timer);
      waiter.resolve(frame);
    }
  }

  private failAll(error: Error): void {
    for (const [id, waiter] of this.pending) {
      if (waiter.timer !== undefined) clearTimeout(waiter.timer);
      this.pending.delete(id);
      waiter.reject(error);
    }
  }

  async request<T>(method: string, params: Record<string, unknown> = {}, vectors: Buffer = Buffer.alloc(0), blocks: VectorBlock[] = []): Promise<RpcResult<T>> {
    this.ensureStarted();
    const child = this.child;
    if (child === undefined) {
      throw new VectorDBError("sidecar_unavailable", "sidecar 未启动");
    }
    const id = this.nextId++;
    const envelope: Envelope = { id, method, params };
    if (blocks.length > 0) envelope.vectors = blocks;
    const timeoutMs = this.options.requestTimeoutMs ?? 0;
    const promise = new Promise<{ header: Envelope; payload: Buffer }>((resolve, reject) => {
      const waiter: Pending = { method, resolve, reject };
      if (timeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new VectorDBError("timeout", `${method} 超过 ${timeoutMs}ms 未返回`, method));
        }, timeoutMs);
      }
      this.pending.set(id, waiter);
      child.stdin.write(encodeFrame(envelope, vectors), (error) => {
        if (error === null || error === undefined) return;
        this.pending.delete(id);
        if (waiter.timer !== undefined) clearTimeout(waiter.timer);
        reject(new VectorDBError("sidecar_exited", `写入 sidecar 失败：${error.message}`, method));
      });
    });
    const { header, payload } = await promise;
    if (header.ok !== true) {
      const rpcError: RpcError = header.error ?? { code: "internal", message: `${method} 失败但没有错误详情` };
      throw new VectorDBError(rpcError.code, rpcError.message, method);
    }
    return { result: header.result as T, payload, outVectors: header.outVectors ?? [] };
  }

  /** 优雅关闭：先发 shutdown，等进程退出；超时则强杀。 */
  async close(graceMs = 5000): Promise<void> {
    const child = this.child;
    this.closing = true;
    if (child === undefined) return;
    try {
      await this.request("shutdown", {});
    } catch {
      // 关闭途中的错误不再抛出：进程无论如何都要收掉。
    }
    await new Promise<void>((resolve) => {
      if (this.child === undefined) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        this.child?.kill("SIGKILL");
        resolve();
      }, graceMs);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.child?.stdin.end();
  }
}
