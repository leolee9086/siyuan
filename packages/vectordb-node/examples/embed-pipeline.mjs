// examples/embed-pipeline.mjs — 端到端数据流：真实文本 → 本地向量服务 → DiskVamana → 检索（含 Recall 对照）
//
// 用法：
//   node examples/embed-pipeline.mjs [--dir <目录>] [--limit 400] [--topk 5]
//                                    [--provider llamacpp|studio|ollama] [--base <url>] [--model <名字>]
//
// provider：
//   llamacpp（默认）— 直接打 llama.cpp 的 OpenAI 兼容口 /v1/embeddings（本机 8099，用 unsloth 自带的 llama-server.exe）
//   studio          — 打 Unsloth Studio 后端 /v1/embeddings（本机 8888，需要 UNSLOTH_STUDIO_API_KEY）
//   ollama          — 打 Ollama /api/embed（保留；模型要自带 pooling 元数据才能用）
//
// 说明：
//   - provider 只认"一批输入 → 一批向量"，模态（文本/图片）由输入项自己带，换成多模态模型时流程不变。
//   - DiskVamana 建库必须带初始点集，所以第一批向量当作建库种子，其余走增量写入。
//   - 检索结果与本地精确余弦 top-k 对照，报 Recall（不做的话无法判断图索引有没有搜对）。
import { readFileSync, readdirSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, relative } from "node:path";

const { openVectorDB } = await import("../dist/index.js");

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};

const CORPUS_DIR = option("dir", "D:\\dev\\SAC_search\\dsh-better-session-query");
const LIMIT = Number(option("limit", "400"));
const TOP_K = Number(option("topk", "5"));
const PROVIDER = option("provider", "llamacpp");
const BATCH = Number(option("batch", "16"));
const CONCURRENCY = Number(option("concurrency", "8"));
const EXTENSIONS = new Set([".md", ".txt", ".mjs", ".ts", ".js"]);

const PROVIDERS = {
  llamacpp: { base: option("base", "http://127.0.0.1:8099"), model: option("model", "local"), style: "openai" },
  studio: {
    base: option("base", "http://127.0.0.1:8888"),
    model: option("model", "default"),
    style: "openai",
    apiKey: process.env.UNSLOTH_STUDIO_API_KEY,
  },
  ollama: {
    base: option("base", process.env.OLLAMA_HOST?.startsWith("http") ? process.env.OLLAMA_HOST : "http://127.0.0.1:11434"),
    model: option("model", "bge-m3"),
    style: "ollama",
  },
};

const active = PROVIDERS[PROVIDER];
if (active === undefined) {
  console.error(`未知 provider：${PROVIDER}（可选 ${Object.keys(PROVIDERS).join(" / ")}）`);
  process.exit(2);
}

const ms = (started) => `${Date.now() - started}ms`;

// ---------- 1) 语料：真实文件按段落切块 ----------

function collectFiles(root, acc = [], depth = 0) {
  if (depth > 4) return acc;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "bin") continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) collectFiles(full, acc, depth + 1);
    else if (EXTENSIONS.has(extname(entry.name))) acc.push(full);
  }
  return acc;
}

function chunkFile(path, root, chunks) {
  const text = readFileSync(path, "utf8");
  const relativePath = relative(root, path);
  // 简单切块：按空行分段，合并到 ~400 字，过长再硬切。
  const paragraphs = text.split(/\r?\n\s*\r?\n/).map((part) => part.trim()).filter((part) => part.length > 40);
  let buffer = "";
  const push = (content) => {
    if (content.trim().length < 40) return;
    chunks.push({ source: relativePath, text: content.trim().slice(0, 900) });
  };
  for (const paragraph of paragraphs) {
    if (buffer.length + paragraph.length > 400) {
      push(buffer);
      buffer = paragraph;
    } else {
      buffer = buffer.length === 0 ? paragraph : `${buffer}\n${paragraph}`;
    }
  }
  push(buffer);
}

const files = collectFiles(CORPUS_DIR).sort();
const chunks = [];
for (const file of files) {
  chunkFile(file, CORPUS_DIR, chunks);
  if (chunks.length >= LIMIT) break;
}
const items = chunks.slice(0, LIMIT).map((chunk, index) => ({
  id: `c${String(index).padStart(4, "0")}`,
  ...chunk,
}));
console.log(`语料：${CORPUS_DIR}`);
console.log(`  扫到 ${files.length} 个文件 → 取前 ${items.length} 块（每块 ≤900 字）`);

// ---------- 2) 向量化（provider 无关；模态可插拔：输入项自己带 text/image）----------

/** 一批输入 → 一批向量。输入项目前只用到 text；接多模态时把 image 一起发出去即可。 */
async function embedBatch(inputs) {
  const texts = inputs.map((item) => item.text);
  const headers = { "content-type": "application/json" };
  if (active.apiKey !== undefined && active.apiKey !== "") headers.authorization = `Bearer ${active.apiKey}`;

  const url = active.style === "ollama" ? `${active.base}/api/embed` : `${active.base}/v1/embeddings`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: active.model, input: texts }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${PROVIDER} ${url} 失败（${response.status}）：${text.slice(0, 240)}`);
  }
  const payload = JSON.parse(text);
  // OpenAI 兼容口返回 {data:[{embedding}]}；Ollama 返回 {embeddings:[...]}。
  if (Array.isArray(payload.embeddings)) return payload.embeddings;
  return (payload.data ?? []).map((entry) => entry.embedding);
}

function normalize(vector) {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const norm = Math.sqrt(sum) || 1;
  return Float32Array.from(vector, (value) => value / norm);
}

const embedStarted = Date.now();
const vectors = [];
{
  // 并发发请求才会用上服务端的并行槽（llama-server -np）；请求内批量则摊薄每请求开销。
  const batches = [];
  for (let offset = 0; offset < items.length; offset += BATCH) batches.push(items.slice(offset, offset + BATCH));
  let cursor = 0;
  let completed = 0;
  const results = new Array(batches.length);
  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= batches.length) return;
      results[index] = await embedBatch(batches[index]);
      completed += results[index].length;
      process.stdout.write(`\r  已向量化 ${completed}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  for (const batch of results) for (const vector of batch) vectors.push(normalize(vector));
}
console.log(`\n  维度 ${vectors[0]?.length}，耗时 ${ms(embedStarted)}`);

// ---------- 3) 建库 + 写入 ----------

const dir = mkdtempSync(join(tmpdir(), "vectordb-ollama-"));
const db = await openVectorDB({ path: dir });
const seedCount = Math.min(64, items.length);
const writeStarted = Date.now();
try {
  const collection = await db.createCollection("memory", {
    engine: "disk-vamana",
    dimension: vectors[0].length,
    distanceMetric: "cosine",
    initialPoints: items.slice(0, seedCount).map((item, index) => ({
      id: item.id,
      vector: vectors[index],
      meta: { source: item.source, text: item.text.slice(0, 160) },
    })),
  });
  console.log(`  建库种子 ${seedCount} 条 → disk-vamana（维度 ${vectors[0].length}、cosine）`);

  for (let offset = seedCount; offset < items.length; offset += BATCH) {
    const slice = items.slice(offset, offset + BATCH);
    await collection.write(
      slice.map((item, index) => ({
        id: item.id,
        vector: vectors[offset + index],
        meta: { source: item.source, text: item.text.slice(0, 160) },
      })),
    );
  }
  console.log(`  增量写入 ${items.length - seedCount} 条，耗时 ${ms(writeStarted)}`);

  const stats = await collection.stats();
  console.log(`  库内：count=${stats.count} engine=${stats.engine} walBytes=${stats.walBytes ?? 0}`);

  // ---------- 4) 检索 + 精确对照 ----------

  const queries = [
    "会话块索引是怎么做增量更新的",
    "为什么不能用 JSON 传向量",
    "DiskVamana 的 BBQ 量化是什么",
    "怎么给 DSH 插件做客户端界面",
  ];

  const exactTopK = (queryVector, k) => {
    const scored = vectors.map((vector, index) => {
      let dot = 0;
      for (let i = 0; i < vector.length; i += 1) dot += vector[i] * queryVector[i];
      return { index, score: dot };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  };

  let hitsTotal = 0;
  let overlapTotal = 0;
  for (const query of queries) {
    const [queryVector] = await embedBatch([{ text: query }]);
    const normalized = normalize(queryVector);
    const searchStarted = Date.now();
    const hits = await collection.search(normalized, { topK: TOP_K, efSearch: 64 });
    const elapsed = Date.now() - searchStarted;
    const exact = exactTopK(normalized, TOP_K);
    const exactIds = new Set(exact.map((entry) => items[entry.index].id));
    const overlap = hits.filter((hit) => exactIds.has(hit.id)).length;
    hitsTotal += hits.length;
    overlapTotal += overlap;
    console.log(`\n查询：「${query}」`);
    console.log(`  图索引 ${elapsed}ms：${hits.map((hit) => `${hit.id}(${hit.score.toFixed(3)})`).join(" ")}`);
    console.log(`  精确对照：${exact.map((entry) => `${items[entry.index].id}(${entry.score.toFixed(3)})`).join(" ")}`);
    console.log(`  Recall@${TOP_K}=${((overlap / Math.max(1, exact.length)) * 100).toFixed(1)}%`);
    for (const hit of hits.slice(0, 2)) {
      const meta = hit.meta ?? {};
      console.log(`    ${hit.id} ← ${meta.source ?? "?"}：${String(meta.text ?? "").replace(/\s+/g, " ").slice(0, 90)}`);
    }
  }
  console.log(`\n总 Recall@${TOP_K}=${((overlapTotal / Math.max(1, hitsTotal)) * 100).toFixed(1)}%（${overlapTotal}/${hitsTotal}）`);

  await collection.checkpoint();
  const afterCheckpoint = await collection.stats();
  console.log(`checkpoint 后：count=${afterCheckpoint.count} walBytes=${afterCheckpoint.walBytes ?? 0}`);
} finally {
  await db.close().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 100));
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // 临时目录被占用不致命。
  }
}
