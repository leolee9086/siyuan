#!/usr/bin/env node
/**
 * websearch-mcp 启动器（@leolee9086/websearch-mcp 包）。
 *
 * 定位平台对应的 Go 预编译二进制：缺失时从项目的 GitHub Releases 下载，
 * 下载不可用时回退 `go build`（本地开发场景）。随后启动二进制并透传
 * argv 与环境变量，stdio 直连。
 *
 * 用法：
 *   npx @leolee9086/websearch-mcp [flags]   运行服务（默认 stdio）
 *   npx @leolee9086/websearch-mcp --install 仅获取/构建二进制
 *   npx @leolee9086/websearch-mcp --version 打印版本
 */
"use strict";

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// 发布时确认以下地址存在对应的 release 资产，文件名为
// websearch-mcp-<platform>-<arch>[.exe]。
const RELEASE_BASE_URL =
  process.env.WEBSEARCH_MCP_RELEASE_URL ||
  "https://github.com/leolee9086/siyuan/releases/download/websearch-mcp-v1.0.0";

const MODULE_ROOT = path.join(__dirname, "..", ".."); // packages/websearch

function platformKey() {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "darwin";
    default:
      return "linux";
  }
}

function archKey() {
  switch (process.arch) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    default:
      return process.arch;
  }
}

function binaryPath() {
  const plat = platformKey();
  const arch = archKey();
  const exe = plat === "windows" ? ".exe" : "";
  // __dirname 即 bin/ 目录本身。
  return path.join(__dirname, `${plat}-${arch}`, `websearch-mcp${exe}`);
}

function buildLocal(target) {
  console.error(`[websearch-mcp] 无预编译二进制，尝试 go build ...`);
  const go = spawnSync("go", ["build", "-o", target, "./cmd/websearch-mcp"], {
    cwd: MODULE_ROOT,
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (go.status !== 0) {
    throw new Error(
      "go build 失败；请安装 Go >= 1.24.5，或设置 WEBSEARCH_MCP_RELEASE_URL " +
        "指向托管预编译 websearch-mcp 二进制的地址"
    );
  }
}

function downloadBinary(target) {
  const plat = platformKey();
  const arch = archKey();
  const exe = plat === "windows" ? ".exe" : "";
  const fileName = `websearch-mcp-${plat}-${arch}${exe}`;
  const url = `${RELEASE_BASE_URL.replace(/\/+$/, "")}/${fileName}`;
  console.error(`[websearch-mcp] 下载 ${url}`);
  const https = url.startsWith("https") ? require("https") : require("http");
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          https.get(res.headers.location, (res2) => {
            pipeToFile(res2, target).then(resolve, reject);
          });
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`下载失败：HTTP ${res.statusCode}，${url}`));
          return;
        }
        pipeToFile(res, target).then(resolve, reject);
      })
      .on("error", reject);
  });
}

function pipeToFile(res, target) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const file = fs.createWriteStream(target, { mode: 0o755 });
    res.pipe(file);
    file.on("finish", () => file.close(() => resolve()));
    file.on("error", reject);
  });
}

function ensureBinary() {
  const target = binaryPath();
  if (fs.existsSync(target)) {
    return Promise.resolve(target);
  }
  return downloadBinary(target).catch(() => {
    buildLocal(target);
    return target;
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--install")) {
    ensureBinary()
      .then((bin) => console.error(`[websearch-mcp] 就绪：${bin}`))
      .catch((err) => {
        console.error(`[websearch-mcp] ${err.message}`);
        process.exit(1);
      });
    return;
  }
  ensureBinary()
    .then((bin) => {
      const child = spawn(bin, args, { stdio: "inherit" });
      child.on("error", (err) => {
        console.error(`[websearch-mcp] 启动失败：${err.message}`);
        process.exit(1);
      });
      child.on("exit", (code, signal) => {
        if (signal) {
          process.kill(process.pid, signal);
        } else {
          process.exit(code === null ? 0 : code);
        }
      });
    })
    .catch((err) => {
      console.error(`[websearch-mcp] ${err.message}`);
      process.exit(1);
    });
}

main();
