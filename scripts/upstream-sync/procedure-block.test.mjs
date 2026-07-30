import assert from "node:assert/strict";
import test from "node:test";
import {
    canonicalizeKramdown,
    hashCanonicalKramdown,
    verifyProcedureSemantics,
    verifyPublishedProcedure,
} from "./procedure-block.mjs";

test("canonical Kramdown hashing ignores IAL attribute order", () => {
    const first = "text\r\n{: id=\"block\" updated=\"20260729\" custom=\"a b\"}\r\n";
    const second = "text\n{: custom=\"a b\" updated=\"20260729\" id=\"block\"}\n";

    assert.equal(canonicalizeKramdown(first), canonicalizeKramdown(second));
    assert.equal(hashCanonicalKramdown(first), hashCanonicalKramdown(second));
});

test("published procedure semantic verification fails closed", () => {
    assert.throws(() => verifyProcedureSemantics("incomplete"), /missing required semantics/);
});

test("read-only verification requires two stable canonical API reads", async () => {
    const semantics = [
        "运行时新鲜度检查必须由版本化 Git hooks 在提交时自动执行",
        "pnpm forge 一次性开发构建 每次 Kernel crash post-commit",
        "不得为了减少 囤积可独立交付 本地 Forge 服务是硬门禁",
        "规范化 Kramdown SHA-256 IAL 属性顺序不稳定",
        "每个新 series 建立前",
        "连续前缀拓扑检查点 不得凭 branch 名",
    ].join("\n");
    const versions = [
        `${semantics}\n{: id="block" updated="123"}`,
        `${semantics}\n{: updated="123" id="block"}`,
    ];
    const routes = [];
    const result = await verifyPublishedProcedure({
        baseURL: "http://127.0.0.1:6806",
        blockID: "block",
        fetchImpl: async (url) => {
            routes.push(url.pathname);
            return {
                ok: true,
                json: async () => ({code: 0, data: {kramdown: versions.shift()}}),
            };
        },
    });

    assert.deepEqual(routes, ["/api/block/getBlockKramdown", "/api/block/getBlockKramdown"]);
    assert.equal(result.updatedAt, "123");
    assert.equal(result.semanticChecks, 13);
});
