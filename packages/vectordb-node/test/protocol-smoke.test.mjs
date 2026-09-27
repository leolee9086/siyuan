// test/protocol-smoke.test.mjs — 裸协议冒烟：直接对 sidecar 二进制发帧，验证帧格式与 DiskVamana 全链路。
//
// 直接运行：node test/protocol-smoke.test.mjs
// （不要用 node --test：本沙箱下它会 spawn 子进程被拦成 EPERM。）
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BINARY = join(HERE, "..", "bin", "vectordb-sidecar.exe");

/** 极简客户端：只做帧编解码，用来验证协议本身。 */
function createRawClient(binaryPath) {
  const child = spawn(binaryPath, [], { stdio: ["pipe", "pipe", "pipe"] });
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
  let buffer = Buffer.alloc(0);
  const waiters = [];
  const events = [];
  child.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (buffer.length < 4) return;
      const total = buffer.readUInt32LE(0);
      if (buffer.length < 4 + total) return;
      const headerLen = buffer.readUInt32LE(4);
      const header = JSON.parse(buffer.subarray(8, 8 + headerLen).toString("utf8"));
      const payload = buffer.subarray(8 + headerLen, 4 + total);
      buffer = buffer.subarray(4 + total);
      // 进度事件与响应共用一条流：事件帧不占用等待位，否则它会被当成响应。
      if (header.event !== undefined) {
        events.push(header.event);
        continue;
      }
      const waiter = waiters.shift();
      if (waiter) waiter({ header, payload });
    }
  });
  let nextId = 1;
  return {
    stderr,
    events,
    call(method, params = {}, packed = []) {
      const blocks = [];
      const parts = [];
      let offset = 0;
      // 每个元素要么是一行裸数组（自成一块），要么是 packVectors 打好的 { block, payload }。
      for (const item of packed) {
        let bytes;
        let block;
        if (Array.isArray(item)) {
          const flat = Float32Array.from(item);
          bytes = Buffer.from(flat.buffer, flat.byteOffset, flat.byteLength);
          block = { offset, count: 1, dimension: item.length };
        } else {
          bytes = item.payload;
          block = { ...item.block, offset };
        }
        blocks.push(block);
        parts.push(bytes);
        offset += bytes.length;
      }
      const header = Buffer.from(JSON.stringify({ id: nextId, method, params, vectors: blocks }), "utf8");
      const payload = Buffer.concat(parts);
      const head = Buffer.alloc(8);
      head.writeUInt32LE(4 + header.length + payload.length, 0);
      head.writeUInt32LE(header.length, 4);
      const id = nextId++;
      const promise = new Promise((resolve) => waiters.push(resolve));
      child.stdin.write(Buffer.concat([head, header, payload]));
      return promise.then(({ header: responseHeader, payload: responsePayload }) => ({
        ...responseHeader,
        id,
        payload: responsePayload,
      }));
    },
    close() {
      child.stdin.end();
      return new Promise((resolve) => child.on("exit", resolve));
    },
  };
}

/** 把一组等长向量打成一个向量块（载荷里就是行主序的 float32）。 */
function packVectors(vectors) {
  const dimension = vectors[0].length;
  const flat = new Float32Array(vectors.length * dimension);
  vectors.forEach((vector, row) => flat.set(vector, row * dimension));
  return {
    block: { offset: 0, count: vectors.length, dimension },
    payload: Buffer.from(flat.buffer, flat.byteOffset, flat.byteLength),
  };
}

test("裸协议：ping / open / 建 DiskVamana 集合 / 写入 / 检索 / 取点 / checkpoint / 重启恢复", async () => {
  if (!existsSync(BINARY)) {
    assert.fail(`没有 sidecar 产物：${BINARY}（先跑 node scripts/build-sidecar.mjs）`);
  }
  const dir = mkdtempSync(join(tmpdir(), "vectordb-node-"));
  const client = createRawClient(BINARY);
  try {
    const pong = await client.call("ping");
    assert.equal(pong.ok, true, `ping 失败：${JSON.stringify(pong)}`);
    assert.equal(pong.result.pong, true);

    const opened = await client.call("db.open", { path: dir });
    assert.equal(opened.ok, true, `db.open 失败：${JSON.stringify(opened)}`);

    const initial = packVectors([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0.9, 0.1, 0, 0],
    ]);
    const created = await client.call(
      "db.createCollection",
      {
        name: "memo",
        engine: "disk-vamana",
        dimension: 4,
        distanceMetric: "cosine",
        initialIds: ["a", "b", "c", "d"],
        vectorIndex: 0,
      },
      [initial],
    );
    assert.equal(created.ok, true, `建集合失败：${JSON.stringify(created)}`);
    assert.equal(created.result.engine, "disk-vamana");
    assert.equal(created.result.count, 4);

    const added = packVectors([[0.95, 0.05, 0, 0]]);
    const written = await client.call(
      "collection.write",
      { collection: "memo", durability: "sync", operations: [{ id: "e", vectorIndex: 0 }] },
      [added],
    );
    assert.equal(written.ok, true, `写入失败：${JSON.stringify(written)}`);
    assert.equal(written.result.applied, 1);
    assert.equal(written.result.committed, true);
    assert.equal(written.result.indexHealthy, true);
    assert.ok(
      client.events.some((event) => event.kind === "writeProgress"),
      "写入期间应至少发出一条进度事件",
    );

    const query = packVectors([[1, 0, 0, 0]]);
    const searched = await client.call("collection.search", { collection: "memo", topK: 3, efSearch: 32 }, [query]);
    assert.equal(searched.ok, true, `检索失败：${JSON.stringify(searched)}`);
    assert.ok(searched.result.length >= 1, "至少要有一条结果");
    const ids = searched.result.map((item) => item.id);
    assert.ok(ids.includes("a"), `近邻里应包含 a，实际 ${ids.join(",")}`);
    assert.ok(typeof searched.result[0].score === "number", "结果要带 score");

    const fetched = await client.call("collection.fetchPoints", { collection: "memo", ids: ["e"] });
    assert.equal(fetched.ok, true, `取点失败：${JSON.stringify(fetched)}`);
    assert.equal(fetched.result.points.length, 1);
    assert.equal(fetched.result.points[0].id, "e");
    // 取点会通过载荷回传向量。注意：cosine 集合里存的是**单位化后的向量**，
    // 所以这里校验"单位长度 + 与写入方向一致"，而不是逐分量相等。
    assert.ok(fetched.payload.length >= 16, "取点响应应带向量载荷");
    const restored = new Float32Array(
      fetched.payload.buffer.slice(fetched.payload.byteOffset, fetched.payload.byteOffset + fetched.payload.byteLength),
    );
    const source = [0.95, 0.05, 0, 0];
    const norm = Math.hypot(...restored);
    assert.ok(Math.abs(norm - 1) < 1e-5, `cosine 集合取回的向量应是单位长度，实际 ${norm}`);
    const sourceNorm = Math.hypot(...source);
    const dot = restored.reduce((sum, value, index) => sum + value * source[index], 0);
    assert.ok(Math.abs(dot / (norm * sourceNorm) - 1) < 1e-5, `取回的向量应与写入方向一致，实际余弦 ${dot / (norm * sourceNorm)}`);

    const checkpointed = await client.call("collection.checkpoint", { collection: "memo" });
    assert.equal(checkpointed.ok, true, `checkpoint 失败：${JSON.stringify(checkpointed)}`);
    assert.equal(checkpointed.result.engine, "disk-vamana");

    // 删除：DiskVamana 用墓碑标记，被删的点不许再出现在检索结果里。
    const removed = await client.call("collection.delete", { collection: "memo", ids: ["b"] });
    assert.equal(removed.ok, true, `删除失败：${JSON.stringify(removed)}`);
    const orthogonal = packVectors([[0, 1, 0, 0]]);
    const afterDelete = await client.call("collection.search", { collection: "memo", topK: 5, efSearch: 64 }, [orthogonal]);
    assert.equal(afterDelete.ok, true, `删除后检索失败：${JSON.stringify(afterDelete)}`);
    assert.ok(
      !afterDelete.result.map((item) => item.id).includes("b"),
      `被删的点不该再出现，实际 ${afterDelete.result.map((item) => item.id).join(",")}`,
    );
    const statsAfterDelete = await client.call("collection.stats", { collection: "memo" });
    assert.equal(statsAfterDelete.ok, true);
    assert.ok(statsAfterDelete.result.deletedCount >= 1, `统计应体现墓碑，实际 deletedCount=${statsAfterDelete.result.deletedCount}`);

    const stats = await client.call("collection.stats", { collection: "memo" });
    assert.equal(stats.ok, true);
    // 写入 5 个（a、b、c、d 初始 + e），删掉 1 个（b）：存活 4、总数含墓碑。
    assert.equal(stats.result.count, 4, `存活条数应为 4，实际 ${stats.result.count}`);
    assert.ok(stats.result.totalCount >= 5, `总条数应含墓碑，实际 ${stats.result.totalCount}`);

    const closed = await client.call("db.close");
    assert.equal(closed.ok, true, `关闭失败：${JSON.stringify(closed)}`);

    // 重启恢复：重开同一个目录，再检一次，刚写入的点必须还在。
    const reopened = await client.call("db.open", { path: dir });
    assert.equal(reopened.ok, true, `重开失败：${JSON.stringify(reopened)}`);
    const statsAfter = await client.call("collection.stats", { collection: "memo" });
    assert.equal(statsAfter.ok, true, `重开后取统计失败：${JSON.stringify(statsAfter)}`);
    assert.ok(statsAfter.result.count >= 4, `重开后存活条数应保留，实际 ${statsAfter.result.count}`);
    assert.ok(statsAfter.result.deletedCount >= 1, "重开后墓碑计数应保留");
    const searchAfter = await client.call("collection.search", { collection: "memo", topK: 3, efSearch: 32 }, [query]);
    assert.equal(searchAfter.ok, true, `重开后检索失败：${JSON.stringify(searchAfter)}`);
    assert.ok(
      searchAfter.result.map((item) => item.id).includes("e"),
      `重开后应能检索到 e，实际 ${searchAfter.result.map((item) => item.id).join(",")}`,
    );
    assert.ok(
      !searchAfter.result.map((item) => item.id).includes("b"),
      "重开后墓碑仍然生效",
    );
  } finally {
    await client.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 目录偶发占用不致命：临时目录会被系统清理。
    }
  }
});
