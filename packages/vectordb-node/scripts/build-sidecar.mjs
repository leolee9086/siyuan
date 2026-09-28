// scripts/build-sidecar.mjs — 编译 sidecar 可执行文件到 bin/。
//
// 两种用法：
//   默认             只编当前平台，产物写 bin/vectordb-sidecar[.exe]（本地开发用）
//   --all / --target 交叉编译，产物写 bin/vectordb-sidecar-<平台>-<架构>[.exe]（发布用）
//
// 交叉编译能成立，是因为内核与 sidecar 的依赖全是纯 Go（没有 CGO）；关掉 CGO 编出来的是静态链接，
// Linux 上 glibc 与 musl 都能跑。发布包里同时放几个平台的产物，使用者就不需要 Go 工具链。
//
// 仓库里的 Go 模块通过 sidecar/go.mod 的 replace 指向 ../../vectordb，所以改 Go 侧代码后重跑本脚本即可。
//
// 用法：
//   node scripts/build-sidecar.mjs                      本机平台
//   node scripts/build-sidecar.mjs --all                全部发布目标
//   node scripts/build-sidecar.mjs --target linux/arm64 --target darwin/arm64
//   node scripts/build-sidecar.mjs --dry-run            只打印将执行的命令
// 依赖：本机 Go 工具链（版本需满足 sidecar/go.mod 的 go 指令，缺工具链时 Go 会自动下载）。

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SIDECAR_DIR = join(ROOT, "sidecar");
const BIN_DIR = join(ROOT, "bin");

// 发布目标。文件名用 Node 的叫法（process.platform / process.arch），因为按平台挑文件的正是客户端；
// go 说 windows 与 amd64，Node 说 win32 与 x64 —— 这张表就是那道翻译。
const RELEASE_TARGETS = [
  { goos: "windows", goarch: "amd64", suffix: "win32-x64.exe" },
  { goos: "linux", goarch: "amd64", suffix: "linux-x64" },
  { goos: "linux", goarch: "arm64", suffix: "linux-arm64" },
  { goos: "darwin", goarch: "amd64", suffix: "darwin-x64" },
  { goos: "darwin", goarch: "arm64", suffix: "darwin-arm64" },
];

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const buildAll = argv.includes("--all");
const hostSuffix = process.platform === "win32" ? ".exe" : "";

// --target <goos>/<goarch>，可重复。
const explicitTargets = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] !== "--target") continue;
  const value = argv[i + 1];
  if (value === undefined) {
    console.error("--target 后面要跟 <goos>/<goarch>");
    process.exit(1);
  }
  const parts = value.split("/");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    console.error("--target 的写法是 <goos>/<goarch>，收到：" + value);
    process.exit(1);
  }
  explicitTargets.push({ goos: parts[0], goarch: parts[1] });
  i++;
}

// --out 只对本机平台那次构建有意义。
const outIndex = argv.indexOf("--out");
const outPath = outIndex >= 0 && argv[outIndex + 1] !== undefined
  ? argv[outIndex + 1]
  : join(BIN_DIR, "vectordb-sidecar" + hostSuffix);

// 要编哪些：--target 就编指定的，--all 编全部发布目标，否则只编本机平台。
let plan;
if (buildAll || explicitTargets.length > 0) {
  const wanted = buildAll
    ? RELEASE_TARGETS
    : RELEASE_TARGETS.filter((t) => explicitTargets.some((e) => e.goos === t.goos && e.goarch === t.goarch));
  if (wanted.length === 0) {
    console.error("--target 给的平台不在发布目标表里；支持：" +
      RELEASE_TARGETS.map((t) => t.goos + "/" + t.goarch).join("、"));
    process.exit(1);
  }
  plan = wanted.map((t) => ({ goos: t.goos, goarch: t.goarch, out: join(BIN_DIR, "vectordb-sidecar-" + t.suffix) }));
} else {
  plan = [{ goos: undefined, goarch: undefined, out: outPath }];
}

if (!existsSync(join(SIDECAR_DIR, "go.mod"))) {
  console.error("找不到 " + join(SIDECAR_DIR, "go.mod") + "：sidecar 源码应随包一起分发");
  process.exit(1);
}

// 在 sidecar 目录里问版本：go 会按 go.mod 的 go 指令自动切换到匹配的工具链，
// 因此这里报出的才是真正用于构建的那个版本。
if (!dryRun) {
  const version = spawnSync("go", ["version"], { cwd: SIDECAR_DIR, encoding: "utf8" });
  if (version.error !== undefined || version.status !== 0) {
    console.error("找不到可用的 Go 工具链：请先安装 Go（或确保 PATH 里有 go）");
    console.error(version.error !== undefined ? version.error.message : (version.stderr ?? ""));
    process.exit(1);
  }
  console.log("使用 " + version.stdout.trim());
}

let failed = 0;
for (const target of plan) {
  const cross = target.goos !== undefined;
  const args = ["build"];
  // 交叉编译的产物是发布用的，去掉符号表与调试信息（体积约减三成）。
  if (cross) args.push("-trimpath", "-ldflags", "-s -w");
  args.push("-o", target.out, ".");
  const label = cross ? target.goos + "/" + target.goarch + " " : "";
  if (dryRun) {
    console.log("将执行：" + label + "go " + args.join(" "));
    continue;
  }
  const env = { ...process.env, CGO_ENABLED: "0" };
  if (cross) {
    env.GOOS = target.goos;
    env.GOARCH = target.goarch;
  }
  mkdirSync(dirname(target.out), { recursive: true });
  const build = spawnSync("go", args, { cwd: SIDECAR_DIR, stdio: "inherit", env });
  if (build.error !== undefined) {
    console.error("跑不起 go：" + build.error.message);
    failed = 1;
    continue;
  }
  if (build.status !== 0) {
    console.error(label + "go build 失败（退出码 " + String(build.status) + "）");
    failed = build.status ?? 1;
    continue;
  }
  const size = statSync(target.out).size;
  console.log(label + "sidecar 已生成：" + target.out + "（" + (size / 1024 / 1024).toFixed(1) + " MB）");
}
if (failed !== 0) process.exit(failed);
