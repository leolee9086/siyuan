// scripts/probe-meta.mjs — 诊断脚本：钉住 DiskVamana 的元数据可见性语义。
//
// 问题：写入时带的 meta，什么时候能被 FetchPoints 取回？（写入后 / checkpoint 后 / 重启后）
// 用法：node scripts/probe-meta.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { openVectorDB } = await import("../dist/index.js");

const dir = mkdtempSync(join(tmpdir(), "vectordb-meta-"));
const report = (label, value) => console.log(`${label}: ${value === undefined ? "(没有 meta)" : JSON.stringify(value)}`);

let db = await openVectorDB({ path: dir });
try {
  const col = await db.createCollection("meta", {
    engine: "disk-vamana",
    dimension: 4,
    distanceMetric: "cosine",
    initialPoints: [
      { id: "seed", vector: [1, 0, 0, 0], meta: { from: "initial" } },
      { id: "seed2", vector: [0, 1, 0, 0] },
    ],
  });

  const initialMeta = await col.fetchPoints(["seed"]);
  report("初始点(建库时带的 meta)", initialMeta[0]?.meta);

  await col.write([{ id: "written", vector: [0.5, 0.5, 0, 0], meta: { from: "write" } }]);
  report("写入后立刻取", (await col.fetchPoints(["written"]))[0]?.meta);

  await col.upsert([{ id: "upserted", vector: [0.2, 0.8, 0, 0], meta: { from: "upsert" } }]);
  report("upsert 后立刻取", (await col.fetchPoints(["upserted"]))[0]?.meta);

  const hits = await col.search([1, 0, 0, 0], { topK: 5, efSearch: 64 });
  console.log(`检索结果的 meta：${JSON.stringify(hits.map((hit) => [hit.id, hit.meta]))}`);

  await col.checkpoint();
  report("checkpoint 后取", (await col.fetchPoints(["written"]))[0]?.meta);
  report("checkpoint 后取 upserted", (await col.fetchPoints(["upserted"]))[0]?.meta);
  report("checkpoint 后取 seed", (await col.fetchPoints(["seed"]))[0]?.meta);

  await db.close();
  db = await openVectorDB({ path: dir });
  const reopened = await db.openCollection("meta");
  report("重启后取 written", (await reopened.fetchPoints(["written"]))[0]?.meta);
  report("重启后取 upserted", (await reopened.fetchPoints(["upserted"]))[0]?.meta);
  report("重启后取 seed", (await reopened.fetchPoints(["seed"]))[0]?.meta);
} finally {
  await db.close().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 100));
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // 临时目录被占用不致命。
  }
}
