// scripts/probe-ollama.mjs — 摸清本地 Ollama 的 embedding 接口：模型全名、能力、文本维度、图片输入的形状。
//
// 用法：node scripts/probe-ollama.mjs [模型名]
import { readFileSync } from "node:fs";

const BASE = process.env.OLLAMA_HOST?.startsWith("http") ? process.env.OLLAMA_HOST : "http://127.0.0.1:11434";
const MODEL = process.argv[2] ?? "MedAIBase/Qwen3-VL-Embedding:2b";

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

async function get(path) {
  const response = await fetch(`${BASE}${path}`);
  return { status: response.status, json: await response.json() };
}

const tags = await get("/api/tags");
console.log("本地模型：");
for (const model of tags.json.models ?? []) {
  console.log(`  ${model.name.padEnd(40)} ${(model.size / 1024 / 1024).toFixed(0)} MB`);
}

console.log(`\n=== /api/show ${MODEL} ===`);
const show = await post("/api/show", { model: MODEL });
if (show.status !== 200) {
  console.log(`状态 ${show.status}：${show.text.slice(0, 200)}`);
} else {
  console.log(`capabilities: ${(show.json.capabilities ?? []).join(", ")}`);
  console.log(`family: ${show.json.details?.family}  参数: ${show.json.details?.parameter_size}`);
  const info = show.json.model_info ?? {};
  for (const [key, value] of Object.entries(info)) {
    if (/embed|vision|hidden|projector|head_count|block_count/.test(key)) console.log(`  ${key} = ${value}`);
  }
  if (typeof show.json.template === "string" && show.json.template.length > 0) {
    console.log(`template 片段：${show.json.template.slice(0, 200).replace(/\n/g, "⏎")}`);
  }
}

console.log("\n=== 文本 embedding（/api/embed，input 为字符串数组）===");
const texts = await post("/api/embed", { model: MODEL, input: ["会话块索引的设计", "DiskANN with asymmetric BBQ quantization"] });
if (texts.status !== 200) {
  console.log(`状态 ${texts.status}：${texts.text.slice(0, 300)}`);
} else {
  const vectors = texts.json.embeddings ?? [];
  console.log(`返回 ${vectors.length} 条，维度 ${vectors[0]?.length}，耗时 ${texts.ms}ms`);
  console.log(`首向量前 5 维：${vectors[0]?.slice(0, 5).map((v) => v.toFixed(4)).join(", ")}`);
}

// 图片输入：把几种可能的形状都试一遍，看哪种被接受。
const imagePath = process.argv[3] ?? "C:\\Users\\al765\\.dsh\\attachments\\v1\\objects\\7c\\7ce9023fedee690900740432ad51759b62bed303d786926363bfb9538d0ed106";
let base64;
try {
  base64 = readFileSync(imagePath).toString("base64");
  console.log(`\n图片样本：${imagePath}（${(base64.length / 1024).toFixed(0)} KB base64）`);
} catch (error) {
  console.log(`\n读不到图片样本（${error.message}），跳过图片探测`);
}

if (base64 !== undefined) {
  const shapes = [
    ["input 为 [{ image: base64 }]", { model: MODEL, input: [{ image: base64 }] }],
    ["input 为 [base64 字符串]", { model: MODEL, input: [base64] }],
    ["input 为字符串 + images 数组", { model: MODEL, input: "这张图里是什么", images: [base64] }],
    ["input 为 [[文本, base64]]", { model: MODEL, input: [["描述这张图", base64]] }],
  ];
  for (const [label, body] of shapes) {
    const result = await post("/api/embed", body);
    if (result.status === 200) {
      const vectors = result.json.embeddings ?? [];
      console.log(`  ✓ ${label}：维度 ${vectors[0]?.length}，耗时 ${result.ms}ms`);
    } else {
      console.log(`  ✗ ${label}：状态 ${result.status} ${result.text.slice(0, 160).replace(/\s+/g, " ")}`);
    }
  }
}
