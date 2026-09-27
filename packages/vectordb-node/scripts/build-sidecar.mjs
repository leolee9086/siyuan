// scripts/build-sidecar.mjs — 编译 sidecar 可执行文件到 bin/。
//
// 只编当前平台；仓库里的 Go 模块通过 sidecar/go.mod 的 replace 指向 ../../vectordb，
// 所以改 Go 侧代码后重新跑本脚本即可。
//
// 用法：node scripts/build-sidecar.mjs [--out <路径>]
// 依赖：本机 Go 工具链（版本需满足 sidecar/go.mod 的 go 指令，缺工具链时 Go 会自动下载）。

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SIDECAR_DIR = join(ROOT, "sidecar");
const BIN_DIR = join(ROOT, "bin");
const suffix = process.platform === "win32" ? ".exe" : "";

const outIndex = process.argv.indexOf("--out");
const outPath = outIndex >= 0 && process.argv[outIndex + 1] !== undefined
  ? process.argv[outIndex + 1]
  : join(BIN_DIR, `vectordb-sidecar${suffix}`);

if (!existsSync(join(SIDECAR_DIR, "go.mod"))) {
  console.error(`找不到 ${join(SIDECAR_DIR, "go.mod")}：sidecar 源码应随包一起分发`);
  process.exit(1);
}

// 在 sidecar 目录里问版本：go 会按 go.mod 的 go 指令自动切换到匹配的工具链，
// 因此这里报出的才是真正用于构建的那个版本。
const version = spawnSync("go", ["version"], { cwd: SIDECAR_DIR, encoding: "utf8", shell: process.platform === "win32" });
if (version.status !== 0) {
  console.error("找不到 Go 工具链：请先安装 Go（或确保 PATH 里有 go）");
  console.error(version.stderr ?? "");
  process.exit(1);
}
console.log(`使用 ${version.stdout.trim()}`);

mkdirSync(dirname(outPath), { recursive: true });
const build = spawnSync("go", ["build", "-o", outPath, "."], {
  cwd: SIDECAR_DIR,
  stdio: "inherit",
  shell: process.platform === "win32",
  // 沙箱或受限环境里可以把 Go 的缓存/工具链落到工作区内：设 GOCACHE / GOPATH 即可。
  env: process.env,
});
if (build.status !== 0) {
  console.error(`go build 失败（退出码 ${String(build.status)}）`);
  process.exit(build.status ?? 1);
}

const size = statSync(outPath).size;
console.log(`sidecar 已生成：${outPath}（${(size / 1024 / 1024).toFixed(1)} MB）`);
