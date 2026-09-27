// scripts/run-tests.mjs — 逐个跑 test/*.test.mjs。
//
// 刻意不用 node --test：它会把每个测试文件放进子进程，并在部分受限环境下因为管道 stdio 被拦。
// 这里顺序拉起单个文件、汇总结果，行为在各平台一致。
//
// 用法：node scripts/run-tests.mjs [文件名片段]

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(HERE, "..", "test");
const filter = process.argv[2];

const files = readdirSync(TEST_DIR)
  .filter((name) => name.endsWith(".test.mjs"))
  .filter((name) => filter === undefined || name.includes(filter))
  .sort();

if (files.length === 0) {
  console.error(`没有匹配的测试文件（目录 ${TEST_DIR}${filter === undefined ? "" : `，过滤 ${filter}`}）`);
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [join(TEST_DIR, file)], {
    stdio: "inherit",
    cwd: join(HERE, ".."),
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status !== 0) {
    failed += 1;
    console.error(`✗ ${file}（${elapsed}s，退出码 ${String(result.status)}）`);
  } else {
    console.log(`✓ ${file}（${elapsed}s）`);
  }
}

console.log(`\n共 ${files.length} 个文件，失败 ${failed} 个`);
process.exit(failed === 0 ? 0 : 1);
