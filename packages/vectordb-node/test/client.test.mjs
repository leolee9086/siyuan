// test/client.test.mjs — 走公开封装层的端到端测试（编译后的 dist）。
//
// 覆盖：ping / 建 DiskVamana 集合 / 写入(含进度事件) / upsert / 检索 / 取点 / 删除 /
//       checkpoint / 统计 / 错误码映射 / 关闭后重开（重启恢复）/ 删集合。
//
// 直接运行：node test/client.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "dist", "index.js");

test("封装层：DiskVamana 全链路（建库/写入/检索/删除/checkpoint/重启恢复）", async () => {
  assert.ok(existsSync(DIST), `没有编译产物 ${DIST}：先跑 node_modules/.bin/tsc -p tsconfig.json`);
  const { openVectorDB, VectorDBError } = await import(`file://${DIST.replaceAll("\\", "/")}`);
  const dir = mkdtempSync(join(tmpdir(), "vectordb-client-"));
  let db = await openVectorDB({ path: dir });

  try {
    const pong = await db.ping();
    assert.equal(pong.pong, true);
    assert.equal(pong.protocolVersion, 1);

    // 进度事件：写入期间应能在封装层收到。
    const progress = [];
    db.on("progress", (event) => progress.push(event));

    const collection = await db.createCollection("memo", {
      engine: "disk-vamana",
      dimension: 4,
      distanceMetric: "cosine",
      initialPoints: [
        { id: "a", vector: [1, 0, 0, 0], meta: { kind: "seed" } },
        { id: "b", vector: [0, 1, 0, 0] },
        { id: "c", vector: [0, 0, 1, 0] },
        { id: "d", vector: [0.9, 0.1, 0, 0] },
      ],
    });
    assert.equal(collection.engine, "disk-vamana");
    assert.equal(collection.dimension, 4);
    assert.equal((await collection.stats()).count, 4);

    const written = await collection.write([{ id: "e", vector: [0.95, 0.05, 0, 0], meta: { kind: "written" } }]);
    assert.equal(written.applied, 1);
    assert.equal(written.committed, true);
    assert.equal(written.indexHealthy, true);
    assert.equal(written.durability, "sync");
    assert.ok(written.commitSequence > 0, "写入应带提交序号");
    assert.ok(progress.length > 0, "应收到写入进度事件");

    const hits = await collection.search([1, 0, 0, 0], { topK: 3, efSearch: 32 });
    assert.ok(hits.length >= 1);
    assert.ok(hits.map((hit) => hit.id).includes("a"), `近邻应含 a，实际 ${hits.map((hit) => hit.id).join(",")}`);
    assert.equal(typeof hits[0].score, "number");
    assert.ok(hits.every((hit) => hit.meta === undefined || typeof hit.meta === "object"), "meta 应解析成对象");

    // 取点：cosine 集合里是单位化后的向量。
    const fetched = await collection.fetchPoints(["e"]);
    assert.equal(fetched.length, 1);
    assert.equal(fetched[0].id, "e");
    assert.equal(fetched[0].vector.length, 4);
    const norm = Math.hypot(...fetched[0].vector);
    assert.ok(Math.abs(norm - 1) < 1e-5, `cosine 集合取回的应是单位向量，实际 ${norm}`);
    assert.deepEqual(fetched[0].meta, { kind: "written" });

    // upsert：多行打成一个块，服务端按 ids 切行。
    await collection.upsert([
      { id: "f", vector: [0, 0, 0, 1] },
      { id: "g", vector: [0.5, 0.5, 0, 0] },
    ]);
    const afterUpsert = await collection.stats();
    assert.ok(afterUpsert.count >= 7, `upsert 后存活条数应增加，实际 ${afterUpsert.count}`);

    // 删除：墓碑生效，检索不再返回。
    await collection.delete(["b"]);
    const orthogonal = await collection.search([0, 1, 0, 0], { topK: 5, efSearch: 64 });
    assert.ok(!orthogonal.map((hit) => hit.id).includes("b"), "被删的点不该出现在检索结果里");
    assert.ok((await collection.stats()).deletedCount >= 1, "统计应体现墓碑");

    const checkpoint = await collection.checkpoint();
    assert.equal(checkpoint.engine, "disk-vamana");
    assert.ok(checkpoint.commitSequence >= 0);
    // 删除之后再 checkpoint：墓碑会被回收进新代际（这正是 checkpoint 的用途之一）。
    assert.ok(checkpoint.reclaimedPoints >= 1, `checkpoint 应回收墓碑，实际 ${checkpoint.reclaimedPoints}`);

    // 错误码映射：没有的集合取统计。
    await assert.rejects(
      () => db.openCollection("并不存在的集合"),
      (error) => {
        assert.ok(error instanceof VectorDBError, `应是 VectorDBError，实际 ${error?.constructor?.name}`);
        assert.equal(error.code, "collection_not_found");
        return true;
      },
    );

    // 客户端侧的前置校验：DiskVamana 不带初始点应直接拒绝，不惊动 sidecar。
    await assert.rejects(
      () => db.createCollection("no-seed", { engine: "disk-vamana", dimension: 4 }),
      (error) => {
        assert.equal(error.code, "needs_initial_points");
        return true;
      },
    );

    const statBeforeClose = (await collection.stats()).count;
    await db.close();

    // 重启恢复：重开同一目录，写入与墓碑都要在。
    db = await openVectorDB({ path: dir });
    const reopened = await db.openCollection("memo");
    const statsAfter = await reopened.stats();
    assert.equal(statsAfter.count, statBeforeClose, `重开后存活条数应一致，实际 ${statsAfter.count}`);
    const searchAfter = await reopened.search([1, 0, 0, 0], { topK: 3, efSearch: 32 });
    assert.ok(searchAfter.map((hit) => hit.id).includes("e"), "重开后应能检索到写入的点");
    assert.ok(!searchAfter.map((hit) => hit.id).includes("b"), "重开后被删的点仍然检索不到");
    // 元数据跨重启保留。
    const fetchedAgain = await reopened.fetchPoints(["e"]);
    assert.deepEqual(fetchedAgain[0]?.meta, { kind: "written" }, "重开后 meta 应保留");

    // 删集合后列表里不该再有它。
    await db.deleteCollection("memo");
    const names = (await db.listCollections()).map((item) => item.name);
    assert.ok(!names.includes("memo"), `删集合后不该再出现，实际 ${names.join(",")}`);
  } finally {
    await db.close().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 临时目录被占用不致命。
    }
  }
});
