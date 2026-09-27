# @leolee9086/vectordb

Node 封装：把 s-forge 的 `packages/vectordb`（DiskVamana/DiskANN 与内存 HNSW）通过 **stdio sidecar** 暴露给 Node 使用。

- **零原生构建**：不需要 node-gyp / prebuild，只用本机 Go 工具链把 sidecar 编成一个可执行文件。
- **进程即数据库**：sidecar 持有数据库目录的跨进程独占锁；Node 侧只发请求帧。
- **向量走二进制载荷**：768 维 float32 不经过 JSON，避免膨胀与解析开销。

## 快速开始

```bash
# 1) 编 sidecar（需要 Go，版本需满足 sidecar/go.mod 的 go 指令）
node scripts/build-sidecar.mjs

# 2) 编译 TS
node_modules/.bin/tsc -p tsconfig.json

# 3) 跑测试
node scripts/run-tests.mjs
```

```ts
import { openVectorDB } from "@leolee9086/vectordb";

const db = await openVectorDB({ path: "D:/data/memory.vectordb" });

// DiskVamana 建库必须带初始点集：引擎用它们构建磁盘图。
const memories = await db.createCollection("memories", {
  engine: "disk-vamana",
  dimension: 768,
  distanceMetric: "cosine",
  initialPoints: [
    { id: "m1", vector: embedding1, meta: { at: "2026-09-16", kind: "episode" } },
  ],
});

// 增量写入（走带提交序号与进度事件的写入契约）
const result = await memories.write([{ id: "m2", vector: embedding2, meta: { kind: "note" } }]);
// result: { commitSequence, applied, durability, committed, indexHealthy }

// 检索
const hits = await memories.search(queryVector, { topK: 10, efSearch: 64 });
// hits: [{ id, score, distance, meta? }]

// 元数据取回（cosine 集合里的向量是单位化后的）
const [point] = await memories.fetchPoints(["m2"]);
// point: { id, vector: Float32Array, meta }

await memories.checkpoint();   // 合并 WAL/append 区/墓碑，原子发布新代际
await db.close();              // 关库并收掉 sidecar 进程
```

## 公开面

| 对象 | 方法 |
|---|---|
| `openVectorDB({ path, binary?, cwd?, env?, onLog?, requestTimeoutMs?, autoRestart? })` | 打开数据库（此时才拉起 sidecar） |
| `VectorDB` | `ping()`、`listCollections()`、`createCollection(name, opts)`、`openCollection(name)`、`deleteCollection(name)`、`on("progress", fn)`、`close()` |
| `Collection` | `write(points, {durability})`、`upsert(points)`、`delete(ids)`、`search(vector, opts)`、`fetchPoints(ids)`、`flush()`、`checkpoint()`、`stats()` |

选项：

- `durability`：`"sync"`（默认，返回前落盘）/ `"async"` / `"memory"`。
- `search`：`topK`、`efSearch`、`scoreThreshold`、`excludeIds`、`groupBy`、`maxPerGroup`、`candidateMultiplier`、`timeoutMs`。
- `createCollection`：`engine`（默认 `disk-vamana`）、`dimension`、`distanceMetric`（`l2`/`cosine`/`ip`）、`walCheckpointBytes`、`diskBuild`（`numWorkers`/`chunkSize`/`blockSize`/`writeBufferSize`/`enableBBQ`）。

错误统一抛 `VectorDBError`，`code` 是稳定字符串（由 Go 侧哨兵错误映射）：`collection_not_found`、`database_locked`、`recovery_required`、`needs_initial_points`、`dimension_invalid`、`timeout`、`sidecar_exited` 等。

## 协议（v1）

帧格式（小端）：

```
[u32 总长][u32 头长][JSON 头][二进制载荷]      总长 = 4 + 头长 + 载荷长
```

- 头里带 `id`/`method`/`params`，请求侧 `vectors: [{offset, count, dimension}]` 描述载荷里的向量块（float32、行主序）。
- 响应 `{id, ok, result, error?}`；`fetchPoints` 走 `outVectors` 描述 + 载荷回传向量。
- 写入期间服务端穿插 `{event: {kind: "writeProgress", stage, completed, total}}` 事件帧（不占响应位）。
- 元数据按**原样 JSON 值**透传（不是 JSON 文本）。
- stdout 是协议专用；sidecar 日志走 stderr（可用 `onLog` 接）。

方法：`ping`、`db.open`、`db.close`、`db.listCollections`、`db.createCollection`、`db.openCollection`、`db.deleteCollection`、`collection.write`、`collection.upsert`、`collection.search`、`collection.fetchPoints`、`collection.delete`、`collection.flush`、`collection.checkpoint`、`collection.stats`、`shutdown`。

## 示例：文本 → 向量 → 检索（本地 Ollama）

`examples/ollama-pipeline.mjs` 是跑通的端到端数据流：真实文件按段落切块 → Ollama `/api/embed` 向量化 → DiskVamana 建库/增量写入 → 检索，并与本地精确余弦 top-k 对照报 Recall。

```bash
node examples/ollama-pipeline.mjs --dir D:\path\to\corpus --limit 400 --model bge-m3 --topk 5
```

本机实测（bge-m3，1024 维，RTX 4070）：400 块向量化 10.7s（热态约 27ms/块）、建库+336 条增量写入 407ms、检索 20ms/查询、**Recall@5 = 100%（20/20）**、checkpoint 后 WAL 归零。

配套探针：`scripts/probe-ollama.mjs`（模型清单/能力/接口形状）、`scripts/probe-ollama-meta.mjs`（为什么某个模型不能当 embedding 用）、`scripts/probe-llamacpp.mjs`（llama.cpp 的接口形状与吞吐）、`scripts/bench-embed.mjs`（并发 × 批量 × 切块的吞吐基准）。

### 本机 embedding 服务：启动方式与「CPU 陷阱」

```bash
node scripts/serve-embeddings.mjs            # 默认 8099：Unsloth 的 llama.cpp + VL embedding GGUF + CUDA 运行时
node scripts/serve-embeddings.mjs --check    # 只探测设备与 CUDA 运行时
```

**必须知道的一条**：`llama-server` 既不自动 offload，也不会自己去找 CUDA 运行时 DLL。少了 `-ngl`，或 `PATH` 里没有 `cudart64_*.dll`/`cublas*_*.dll`，它会**静默退回 CPU**——日志里只有一句 `model loaded`，看起来一切正常：

| 配置 | 吞吐 |
|---|---|
| CPU（8 线程，2B F16） | **≈48 token/s**（≈0.44 条/s，24 条要 105 秒） |
| GPU（RTX 4070，`-ngl 999` + CUDA 运行时在 PATH） | **2100–5047 token/s**（并发 8 × 批量 16 时 43 条/s） |

所以启动脚本会先 `--list-devices` 探测并打印设备；探测不到 GPU 时**直接拒绝启动**（要硬跑加 `--force`）。CUDA 运行时按优先级自动找：`--cuda-runtime` 指定 → Unsloth Studio 自带 torch 的 `lib`（本机命中）→ Ollama 的 `cuda_v13` → CUDA Toolkit 的 `bin`。

完整流水线实测（400 块真实文本，块长 ≤900 字，2048 维）：

| 环节 | 数值 |
|---|---|
| 向量化（并发 8 × 批量 16） | 18.4s（≈46ms/块） |
| DiskVamana 建库 + 336 条增量写入 | 531ms |
| 检索（topK 5、efSearch 64） | 35–37ms/查询 |
| Recall@5 vs 精确余弦 | 20/20 = 100% |

**显存提醒**：`-c 32768 -np 8 -b 8192` 下 F16 模型实测占用 11710 MiB / 12281 MiB，已经贴顶；要和 Studio 自己的推理同时跑，就调小 `--ctx`/`--slots`/`--batch`。

**注意 `score` 的口径**：cosine 集合里引擎返回的 `score = 1 - distance/2`（见库 README），**不等于**原始余弦相似度（原始余弦会略低，例如引擎 0.828 对应原始 0.656）；排序一致，但别把两者混着比较。

**多模态现状**：Ollama 依据 GGUF 里的 `pooling_type` 决定模型能否做 embedding。本机的 `MedAIBase/Qwen3-VL-Embedding:2b` 缺该字段（`capabilities: tools, completion`），因此 `/api/embed` 与 `/v1/embeddings` 都返回 501；它同时缺 vision projector 元数据。要用多模态 embedding，需要带 pooling 元数据的 GGUF（含 mmproj），或直接用 Ollama 自带的 `llama-server.exe` 以 `--embeddings`（需要时加 `--mmproj`）另起一个服务。文本这条路（bge-m3 / nomic-embed-text）不受影响。

## 行为约定（都用测试钉住了）

1. **DiskVamana 建库必须带初始点集**：库返回 `ErrDiskVamanaNeedsPoints`，封装层在客户端侧就拦下并抛 `needs_initial_points`。
2. **`cosine` 集合里存的是单位化向量**：`fetchPoints` 取回的是单位向量（方向不变、模长为 1），不要假设能拿回写入时的原始分量。
3. **墓碑与检查点**：删除对检索立即生效（不再返回被删点）；墓碑**跨重启保留**，但**会被 `checkpoint` 回收**（看 `CheckpointResult.reclaimedPoints`）。所以"删完立刻 checkpoint"与"删完直接重启"两种顺序，重启后的 `deletedCount` 不一样。
4. **元数据保留**：`meta` 在建库初始点、写入、upsert、检索结果、checkpoint 之后、重启之后都能取回。
5. **一个数据库目录一个进程**：库持有目录级独占锁，第二个进程打开会得到 `database_locked`。
6. **关闭即收进程**：`db.close()` 先关库（落盘、清 WAL）再收 sidecar；重复调用无副作用。

## 与十年记忆规模相关的注意点

- **能力来自 DiskVamana**：图常驻磁盘、WAL + 原子代际 + 后台 checkpoint，适合"单库长期累积"的用法；内存 HNSW 只适合小集合或临时索引。
- **量化**：DiskVamana 用非对称 BBQ（query 4-bit × data 1-bit + 每向量 float32 补偿），768 维下约 **100 字节/向量**（相比 f32 的 3072 字节约 31×）；`dim ≥ 64` 时默认启用（可用 `diskBuild.enableBBQ` 覆盖）。
- **元数据与原文不要塞进向量库**：向量库只保证 id + 向量 + meta 的存取；长期记忆的正文、时间线、来源关系建议留在你自己的关系库里，用 id 关联（本封装只搬运，不做冗余存储）。
- **写入批次**：批量越大越省（每批一个 WAL 帧 + 一次提交序号），但要留意单帧内存占用（当前实现会把整批载荷放进一个帧）。
- **checkpoint 时机**：`stats().checkpointRecommended` 会给出建议；也可按 `walCheckpointBytes` 让引擎自己安排。

## 目录结构

```
vectordb-node/
├── sidecar/            Go 侧可执行入口（go.mod 用 replace 指向 ../../vectordb）
├── src/                协议、客户端、门面（TS）
├── scripts/            编 sidecar / 跑测试 / 元数据探针
├── test/               裸协议冒烟 + 封装层端到端
└── bin/                编出来的 sidecar（不随源码分发）
```

`sidecar/go.mod` 里有一行 `replace s-forge.local/vectordb => ../../vectordb`：**封装直接编仓库里的 Go 模块**，不依赖任何已发布的 Go 包；改 Go 侧代码后重跑 `node scripts/build-sidecar.mjs` 即可。
