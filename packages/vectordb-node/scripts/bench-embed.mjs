// scripts/bench-embed.mjs — embedding 吞吐基准：同一批真实文本，换客户端并发/请求批量/切块大小，量 items/s 与 token/s。
//
// 用法：node scripts/bench-embed.mjs [--base http://127.0.0.1:8099] [--items 64] [--dir <语料目录>] [--chunk 400]
//
// 说明：服务端并发槽（llama-server -np）只有在客户端真正并发发请求时才会被用上；
// 一个请求里塞多条输入，仍是在同一个槽里顺序处理。所以两者都要扫。
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};

const BASE = option("base", "http://127.0.0.1:8099");
const ITEMS = Number(option("items", "64"));
const CHUNK = Number(option("chunk", "400"));
const DIR = option("dir", "D:\\dev\\SAC_search\\dsh-better-session-query");
const EXTENSIONS = new Set([".md", ".txt", ".mjs", ".ts", ".js"]);

function collect(root, acc = [], depth = 0) {
  if (depth > 4) return acc;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ["node_modules", "dist", "bin"].includes(entry.name)) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) collect(full, acc, depth + 1);
    else if (EXTENSIONS.has(extname(entry.name))) acc.push(full);
  }
  return acc;
}

const texts = [];
for (const file of collect(DIR).sort()) {
  const content = readFileSync(file, "utf8");
  for (const paragraph of content.split(/\r?\n\s*\r?\n/)) {
    const trimmed = paragraph.trim();
    if (trimmed.length < 40) continue;
    // 按目标长度切块（长段落硬切），模拟真实入库的块大小。
    for (let offset = 0; offset < trimmed.length; offset += CHUNK) {
      texts.push(trimmed.slice(offset, offset + CHUNK));
      if (texts.length >= ITEMS) break;
    }
    if (texts.length >= ITEMS) break;
  }
  if (texts.length >= ITEMS) break;
}

async function embedOnce(input) {
  const response = await fetch(`${BASE}/v1/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "local", input: Array.isArray(input) ? input : [input] }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
  const payload = await response.json();
  return { vectors: (payload.data ?? []).map((entry) => entry.embedding), tokens: payload.usage?.prompt_tokens ?? 0 };
}

console.log(`语料块：${texts.length} 条，切块 ${CHUNK} 字，平均 ${Math.round(texts.reduce((sum, text) => sum + text.length, 0) / texts.length)} 字`);
console.log(`服务：${BASE}\n`);
console.log("并发  请求内批量   总耗时      条/秒    token/秒   维度");

for (const [concurrency, batch] of [[1, 1], [1, 16], [4, 1], [4, 4], [8, 1], [8, 4], [8, 16]]) {
  const chunks = [];
  for (let offset = 0; offset < texts.length; offset += batch) chunks.push(texts.slice(offset, offset + batch));
  const started = Date.now();
  let produced = 0;
  let tokens = 0;
  let dimension = 0;
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= chunks.length) return;
      const result = await embedOnce(chunks[index]);
      produced += result.vectors.length;
      tokens += result.tokens;
      dimension = result.vectors[0]?.length ?? dimension;
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  const elapsed = Date.now() - started;
  console.log(
    `${String(concurrency).padStart(4)}  ${String(batch).padStart(10)}  ${String(elapsed).padStart(8)}ms  ` +
      `${(produced / (elapsed / 1000)).toFixed(2).padStart(7)}  ${(tokens / (elapsed / 1000)).toFixed(1).padStart(9)}  ${dimension}`,
  );
}
