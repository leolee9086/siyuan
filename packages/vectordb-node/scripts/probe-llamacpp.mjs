// scripts/probe-llamacpp.mjs — 探本机 llama.cpp 服务的 embedding 接口（批量/单条/原生）与吞吐。
//
// 用法：node scripts/probe-llamacpp.mjs [baseUrl]
const BASE = process.argv[2] ?? "http://127.0.0.1:8099";

async function post(path, body) {
  const started = Date.now();
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, ms: Date.now() - started, json, text };
}

const health = await fetch(`${BASE}/health`).then((r) => r.status).catch((error) => error.message);
console.log(`健康检查：${health}`);

const texts = [
  "会话块索引是怎么做增量更新的",
  "为什么不要把向量塞进 JSON",
  "DiskVamana 的非对称 BBQ 量化",
  "WebGPU 双调排序的通道语义",
  "十年记忆规模下的磁盘图与量化取舍",
  "上下文压缩与检查点",
  "只读 SQL 通道怎么防止写库",
  "中文召回为什么要插零宽空格",
];

console.log("\n=== /v1/embeddings 批量（8 条一次）===");
const batch = await post("/v1/embeddings", { model: "local", input: texts });
if (batch.status !== 200) {
  console.log(`状态 ${batch.status}：${batch.text.slice(0, 240)}`);
} else {
  const data = batch.json.data ?? [];
  console.log(`返回 ${data.length} 条，维度 ${data[0]?.embedding?.length}，总耗时 ${batch.ms}ms（${(batch.ms / data.length).toFixed(1)}ms/条）`);
}

console.log("\n=== /v1/embeddings 单条 ===");
const single = await post("/v1/embeddings", { model: "local", input: "单条输入" });
console.log(single.status === 200 ? `维度 ${single.json.data?.[0]?.embedding?.length}，${single.ms}ms` : `状态 ${single.status}：${single.text.slice(0, 200)}`);

console.log("\n=== 原生 /embedding 单条 ===");
const native = await post("/embedding", { content: "原生接口" });
if (native.status === 200) {
  const vec = native.json.embedding ?? native.json.data?.[0]?.embedding;
  console.log(`维度 ${vec?.length}，${native.ms}ms`);
} else {
  console.log(`状态 ${native.status}：${native.text.slice(0, 200)}`);
}

console.log("\n=== 吞吐：48 条分批 ===");
const many = Array.from({ length: 48 }, (_, index) => `吞吐测试第 ${index} 条：向量检索与磁盘图的组合`);
const started = Date.now();
let done = 0;
for (let offset = 0; offset < many.length; offset += 16) {
  const slice = many.slice(offset, offset + 16);
  const result = await post("/v1/embeddings", { model: "local", input: slice });
  if (result.status !== 200) {
    console.log(`第 ${offset} 批失败：${result.status} ${result.text.slice(0, 160)}`);
    break;
  }
  done += (result.json.data ?? []).length;
}
const elapsed = Date.now() - started;
console.log(`完成 ${done}/${many.length} 条，耗时 ${elapsed}ms（${(elapsed / Math.max(1, done)).toFixed(1)}ms/条）`);
