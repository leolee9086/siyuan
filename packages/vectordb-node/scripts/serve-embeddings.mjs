// scripts/serve-embeddings.mjs — 起一个本机 embedding 服务（Unsloth 自带的 llama.cpp + CUDA 运行时）。
//
// 为什么需要这个脚本：llama-server 不会自动 offload，也不会自己找到 CUDA 运行时 DLL。
// 少了 `-ngl` 或 PATH 里缺 cudart/cublas，它会**静默退回 CPU**——实测同一台机器上
// CPU 约 48 token/s、GPU 约 2100–5000 token/s（差约 100×），而且日志里只有一句 "model loaded"。
// 所以这里显式：① 先探测设备并打印；② 把 CUDA 运行时目录加进 PATH；③ 带 -ngl 全量 offload。
//
// 用法：
//   node scripts/serve-embeddings.mjs [--port 8099] [--model <gguf 路径>] [--ctx 32768] [--slots 8] [--batch 8192]
//   node scripts/serve-embeddings.mjs --check          # 只探测设备与 CUDA 运行时，不起服务
import { existsSync, readdirSync, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const LLAMA_SERVER = option("server", process.env.LLAMA_SERVER
  ?? "C:\\Users\\al765\\.unsloth\\llama.cpp\\build\\bin\\Release\\llama-server.exe");
const MODEL = option("model", process.env.EMBED_MODEL
  ?? "C:\\Users\\al765\\.ollama\\models\\.studio_links\\fa8986ef51\\MedAIBase-Qwen3-VL-Embedding-2b-F16.gguf");
const PORT = Number(option("port", "8099"));
const CTX = Number(option("ctx", "32768"));
const SLOTS = Number(option("slots", "8"));
const BATCH = Number(option("batch", "8192"));
const POOLING = option("pooling", "last");

/** CUDA 运行时（cudart/cublas）可能散落在各处：按优先级找第一个真有 cudart64_*.dll 的目录。 */
const CUDA_RUNTIME_CANDIDATES = [
  option("cuda-runtime", ""),
  "C:\\Users\\al765\\.unsloth\\studio\\unsloth_studio\\Lib\\site-packages\\torch\\lib",
  "C:\\Users\\al765\\AppData\\Local\\Programs\\Ollama\\lib\\ollama\\cuda_v13",
  "C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v12.6\\bin",
];

function findCudaRuntime() {
  for (const dir of CUDA_RUNTIME_CANDIDATES) {
    if (dir === "" || !existsSync(dir)) continue;
    const hasCudart = readdirSync(dir).some((name) => /^cudart64_\d+\.dll$/.test(name));
    if (hasCudart) return dir;
  }
  return undefined;
}

function check(serverPath, pathValue) {
  const result = spawnSync(serverPath, ["--list-devices"], { encoding: "utf8", env: { ...process.env, PATH: pathValue } });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  const devices = output.split(/\r?\n/).filter((line) => line.trim() !== "" && !line.startsWith("Available devices"));
  return { output, devices, gpu: devices.some((line) => /CUDA|Vulkan|ROCm/i.test(line)) };
}

if (!existsSync(LLAMA_SERVER)) {
  console.error(`找不到 llama-server：${LLAMA_SERVER}（用 --server 指定，或设 LLAMA_SERVER）`);
  process.exit(1);
}
if (!existsSync(MODEL)) {
  console.error(`找不到模型：${MODEL}（用 --model 指定，或设 EMBED_MODEL）`);
  process.exit(1);
}

const cudaRuntime = findCudaRuntime();
const pathValue = cudaRuntime === undefined ? process.env.PATH : `${cudaRuntime};${process.env.PATH}`;
console.log(`llama-server：${LLAMA_SERVER}`);
console.log(`模型：${MODEL}（${(statSync(MODEL).size / 1024 / 1024).toFixed(0)} MB）`);
console.log(`CUDA 运行时：${cudaRuntime ?? "(没找到；很可能只能跑 CPU)"}`);

const probe = check(LLAMA_SERVER, pathValue);
console.log(`设备探测：${probe.devices.length > 0 ? probe.devices.join(" | ") : "(none)"}`);
if (!probe.gpu) {
  console.error("⚠ 没有可用 GPU 设备：这个进程会以 CPU 推理（实测约 48 token/s，比 GPU 慢约 100×）。");
  console.error("  检查：① ggml-cuda.dll 是否在 llama-server 同目录；② CUDA 运行时目录是否用 --cuda-runtime 指对。");
  if (!flag("force")) {
    console.error("  仍要继续请加 --force。");
    process.exit(2);
  }
}
if (flag("check")) process.exit(0);

const serverArgs = [
  "-m", MODEL,
  "--embeddings", "--pooling", POOLING,
  "-ngl", "999",
  "--host", "127.0.0.1", "--port", String(PORT),
  "-c", String(CTX), "-np", String(SLOTS), "-b", String(BATCH), "-ub", String(BATCH),
  "--no-webui",
];
console.log(`启动：llama-server ${serverArgs.join(" ")}\n`);
const child = spawn(LLAMA_SERVER, serverArgs, {
  stdio: "inherit",
  env: { ...process.env, PATH: pathValue },
});
child.on("exit", (code) => process.exit(code ?? 0));
