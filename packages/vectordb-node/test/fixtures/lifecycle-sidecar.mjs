// 真进程、真协议：可控地制造打开失败与关闭无响应，检查资源回收而非模拟方法调用。
import { writeFileSync } from "node:fs";
import { FrameDecoder, encodeFrame } from "../../dist/protocol.js";

const mode = process.env.VECTORDB_TEST_MODE;
if (process.env.VECTORDB_TEST_PID) writeFileSync(process.env.VECTORDB_TEST_PID, String(process.pid));
const decoder = new FrameDecoder();
process.stdin.on("data", (chunk) => {
  for (const { header } of decoder.push(chunk)) {
    const reply = { id: header.id, ok: true, result: { pid: process.pid } };
    if (header.method === "db.open" && mode === "open-fail") {
      reply.ok = false;
      reply.error = { code: "database_locked", message: "fixture: lock denied" };
    }
    if (header.method === "db.close" && mode === "dbclose-hang") continue;
    if (header.method === "shutdown" && ["shutdown-hang", "dbclose-hang"].includes(mode)) continue;
    process.stdout.write(encodeFrame(reply));
    if (header.method === "shutdown") {
      // 响应后故意仍活着一小段时间，close 必须等进程退出才算完成。
      setTimeout(() => process.exit(0), 40);
    }
  }
});
