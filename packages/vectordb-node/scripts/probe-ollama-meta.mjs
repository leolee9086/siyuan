// scripts/probe-ollama-meta.mjs — 为什么 VL embedding 模型不支持 /api/embed：看元数据与各模型的 capabilities。
//
// 用法：node scripts/probe-ollama-meta.mjs
const BASE = "http://127.0.0.1:11434";

async function show(model) {
  const response = await fetch(`${BASE}/api/show`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (response.status !== 200) return { status: response.status };
  return { status: 200, json: await response.json() };
}

const targets = [
  "MedAIBase/Qwen3-VL-Embedding:2b",
  "bge-m3:latest",
  "nomic-embed-text:latest",
  "qwen3-vl:2b",
];

for (const model of targets) {
  const result = await show(model);
  if (result.status !== 200) {
    console.log(`\n=== ${model} === 状态 ${result.status}`);
    continue;
  }
  console.log(`\n=== ${model} ===`);
  console.log(`capabilities: ${(result.json.capabilities ?? []).join(", ")}`);
  const info = result.json.model_info ?? {};
  const pooling = Object.entries(info).filter(([key]) => /pooling|embed/i.test(key));
  console.log(`pooling/embed 相关键：${pooling.length === 0 ? "(没有)" : pooling.map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`projector/vision 相关键：${Object.keys(info).filter((key) => /projector|mmproj|vision/.test(key)).slice(0, 6).join(", ") || "(没有)"}`);
  const files = result.json.projector_info ?? result.json.mmproj_info;
  if (files !== undefined) console.log(`projector 文件：${JSON.stringify(files)}`);
}

console.log("\n=== OpenAI 兼容口 /v1/embeddings 也试一次（同一个 runner，用来看是否同样 501）===");
for (const model of ["MedAIBase/Qwen3-VL-Embedding:2b", "bge-m3:latest"]) {
  const response = await fetch(`${BASE}/v1/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, input: "会话块索引" }),
  });
  const text = await response.text();
  let dims = "?";
  if (response.status === 200) {
    try {
      dims = JSON.parse(text).data?.[0]?.embedding?.length ?? "?";
    } catch {
      dims = "?";
    }
  }
  console.log(`  ${model}: 状态 ${response.status} 维度 ${dims} ${response.status === 200 ? "" : text.slice(0, 140).replace(/\s+/g, " ")}`);
}
