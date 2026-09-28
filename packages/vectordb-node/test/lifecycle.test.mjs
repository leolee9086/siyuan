import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SidecarClient } from "../dist/client.js";
import { openVectorDB } from "../dist/index.js";

const fixture = fileURLToPath(new URL("./fixtures/lifecycle-sidecar.mjs", import.meta.url));
const options = (mode, extra = {}) => ({
  binary: process.execPath,
  args: [fixture],
  env: { VECTORDB_TEST_MODE: mode, ...extra },
});
function assertExited(pid) {
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" }, `进程 ${pid} 必须已经退出`);
}

test("打开失败由创建方收进程，再返回原始错误", { timeout: 3000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "vectordb-lifecycle-"));
  const pidFile = join(dir, "pid");
  try {
    await assert.rejects(openVectorDB({ path: dir, ...options("open-fail", { VECTORDB_TEST_PID: pidFile }) }),
      { code: "database_locked", message: "fixture: lock denied" });
    assertExited(Number(readFileSync(pidFile, "utf8")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("shutdown 不回应仍按期限退出，并发 close 等待同一次清理", { timeout: 3000 }, async () => {
  const client = new SidecarClient(options("shutdown-hang"));
  const { result: { pid } } = await client.request("ping");
  const started = Date.now();
  const closing = client.close(80);
  assert.equal(client.close(), closing);
  await closing;
  assert.ok(Date.now() - started < 2000);
  assertExited(pid);
  await assert.rejects(client.request("ping"), { code: "database_closed" });
  assert.equal(client.pid, undefined);
});

test("公开 db.close 无响应也受总期限约束，拒绝前回收进程", { timeout: 3000 }, async () => {
  const db = await openVectorDB({ path: "unused-fixture-path", ...options("dbclose-hang") });
  const pid = db.pid;
  const closing = db.close(80);
  assert.equal(db.close(), closing);
  await assert.rejects(closing, { code: "timeout" });
  assertExited(pid);
});

test("正常关闭等待进程退出，关闭后不能重新启动", { timeout: 3000 }, async () => {
  const client = new SidecarClient(options("normal"));
  const { result: { pid } } = await client.request("ping");
  await client.close();
  assertExited(pid);
  await assert.rejects(client.request("ping"), { code: "database_closed" });
});

test("不存在的可执行文件打开失败后能结束", { timeout: 3000 }, async () => {
  await assert.rejects(openVectorDB({ path: "unused", binary: join(tmpdir(), "missing-vectordb-binary-test") }),
    { code: "sidecar_unavailable" });
});
