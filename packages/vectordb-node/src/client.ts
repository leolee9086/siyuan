/**
 * sidecar 进程客户端：拉起可执行文件、按帧收发、管理生命周期。
 *
 * 约定：
 *   - stdout 是协议专用；子进程的日志走 stderr（本客户端收下来交给 onLog，或丢弃）。
 *   - 一个请求一个响应；写入期间服务端会穿插进度事件，事件不占用响应位，交给 on("progress")。
 *   - 子进程意外退出时，所有在飞请求立刻以 sidecar_exited 拒绝，并（默认）在下次请求时重新拉起。
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
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
  /** 可选启动参数，供解释器或侧车启动器使用；默认直接执行二进制。 */
  args?: readonly string[];
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

/** bin/ 里现有哪些 sidecar 产物；只用来把错误信息写具体。 */
function listSidecarBinaries(binDir: string): string {
  try {
    const names = readdirSync(binDir).filter((name) => name.startsWith("vectordb-sidecar"));
    return names.length > 0 ? `bin/ 里有：${names.join("、")}` : "bin/ 里没有任何 sidecar 产物";
  } catch {
    return "bin/ 目录不存在";
  }
}

/**
 * 按平台找包内 bin/ 下的 sidecar；可用 binary 选项或 VECTORDB_SIDECAR 环境变量覆盖。
 *
 * 发布包带多个平台的预编译产物，文件名是 vectordb-sidecar-<平台>-<架构>，用 Node 的叫法
 * （win32-x64、linux-arm64、darwin-arm64…）—— 挑文件的正是这里。不带平台后缀的那个是本机
 * 开发编出来的，排在后面当兜底。
 */
export function resolveSidecarBinary(explicit?: string): string {
  if (explicit !== undefined && explicit !== "") return explicit;
  const fromEnv = process.env.VECTORDB_SIDECAR;
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/ 与 src/ 同在包内，bin/ 在包根：两种深度都试一遍。
  const suffix = process.platform === "win32" ? ".exe" : "";
  const names = [
    `vectordb-sidecar-${process.platform}-${process.arch}${suffix}`,
    `vectordb-sidecar${suffix}`,
  ];
  const candidates: string[] = [];
  for (const name of names) {
    candidates.push(join(here, "..", "bin", name), join(here, "..", "..", "bin", name));
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new VectorDBError(
    "sidecar_unavailable",
    `找不到当前平台的 sidecar（${process.platform}/${process.arch}）；试过：${candidates.join("、")}；` +
      `${listSidecarBinaries(join(here, "..", "bin"))}；从源码重建见 README，或用 binary 选项指定`,
  );
}

export class SidecarClient {
  private child: ChildProcessWithoutNullStreams | undefined;
  private decoder = new FrameDecoder();
  private closePromise: Promise<void> | undefined;
  private readonly pending = new Map<number, Pending>();
  private readonly progressHandlers: ((event: ProgressEvent) => void)[] = [];
  private nextId = 1;
  private closing = false;
  private started = false;
  private readonly binary: string;
  /** 子进程 stderr 的末尾若干行：它失败时唯一的解释渠道，出错时要能带出去。 */
  private readonly stderrTail: string[] = [];

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
    if (this.closing) throw new VectorDBError("database_closed", "客户端已关闭");
    if (this.started && this.options.autoRestart === false) {
      throw new VectorDBError("sidecar_exited", "sidecar 已退出，自动重启已禁用");
    }
    // 每个进程有独立的协议流，不能把旧进程的半帧拼进新响应。
    this.decoder = new FrameDecoder();
    this.stderrTail.length = 0;
    const child = spawn(this.binary, [...(this.options.args ?? [])], {
      cwd: this.options.cwd,
      env: this.options.env === undefined ? process.env : { ...process.env, ...this.options.env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    this.started = true;
    child.stdout.on("data", (chunk: Buffer) => this.handleChunk(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      // 没给 onLog 也要留住末尾几行：否则一次启动失败在调用方看来只是"没反应"。
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim() === "") continue;
        this.stderrTail.push(line);
        if (this.stderrTail.length > 20) this.stderrTail.shift();
        this.options.onLog?.(line);
      }
    });
    // 流的 error 与 write 回调可以同时发生；必须消费事件，避免 EPIPE 终止宿主。
    child.stdin.on("error", (error) => {
      if (this.child === child) this.failAll(new VectorDBError("sidecar_exited", error.message));
    });
    child.on("error", (error) => {
      if (this.child !== child) return;
      this.child = undefined;
      this.failAll(new VectorDBError("sidecar_unavailable", error.message + this.describeStderr()));
    });
    child.on("exit", (code, signal) => {
      if (this.child !== child) return;
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

  /** 把子进程 stderr 的末尾几行拼成一句话，用来解释失败。没有就不拼。 */
  private describeStderr(): string {
    if (this.stderrTail.length === 0) return "";
    return `；sidecar 最后说：${this.stderrTail.slice(-5).join(" | ")}`;
  }

  private failAll(error: Error): void {
    for (const [id, waiter] of this.pending) {
      if (waiter.timer !== undefined) clearTimeout(waiter.timer);
      this.pending.delete(id);
      waiter.reject(error);
    }
  }

  async request<T>(method: string, params: Record<string, unknown> = {}, vectors: Buffer = Buffer.alloc(0), blocks: VectorBlock[] = [], timeoutMs = this.options.requestTimeoutMs ?? 0): Promise<RpcResult<T>> {
    if (this.closing && method !== "shutdown") {
      throw new VectorDBError("database_closed", "客户端正在关闭", method);
    }
    this.ensureStarted();
    const child = this.child;
    if (child === undefined) {
      throw new VectorDBError("sidecar_unavailable", "sidecar 未启动");
    }
    const id = this.nextId++;
    const envelope: Envelope = { id, method, params };
    if (blocks.length > 0) envelope.vectors = blocks;
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

  /** 截止时间涵盖 shutdown 响应与退出；所有调用者等待同一次资源回收。 */
  close(graceMs = 5000): Promise<void> {
    if (this.closePromise !== undefined) return this.closePromise;
    if (!Number.isFinite(graceMs) || graceMs < 0) {
      return Promise.reject(new VectorDBError("invalid_argument", "关闭期限必须是非负有限毫秒数"));
    }
    const child = this.child;
    this.closing = true;
    if (child === undefined) return this.closePromise = Promise.resolve();
    this.closePromise = new Promise<void>((resolve) => {
      // 必须在发请求前布置期限。只等 close：此时进程和全部 stdio 才都已收回。
      const timer = setTimeout(() => {
        this.failAll(new VectorDBError("timeout", "sidecar 关闭超时，强制终止"));
        child.kill("SIGKILL");
      }, graceMs);
      child.once("close", () => {
        clearTimeout(timer);
        if (this.child === child) this.child = undefined;
        this.failAll(new VectorDBError("database_closed", "客户端已关闭"));
        resolve();
      });
      void this.request("shutdown").catch(() => {
        // 请求失败仍由进程 close 或期限负责收尾，不允许在这里提前宣称完成。
      });
    });
    return this.closePromise;
  }
}
