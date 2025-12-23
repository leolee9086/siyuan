/**
 * 向量直推与专用集合保护 - 端到端测试
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const API_BASE = "http://127.0.0.1:6806";

interface APIResponse<T = unknown> {
    code: number;
    msg?: string;
    data?: T;
}

const postAPI = async <T>(path: string, body: unknown): Promise<APIResponse<T>> => {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return res.json();
};

describe("Embedding 专用集合保护测试", () => {
    const 模型名 = "leolee9086_text2vec-base-chinese";
    const blocks集合名 = `blocks_embedding_${模型名}`;
    const assets集合名 = `assets_embedding_${模型名}`;
    const 普通集合名 = "test_normal_collection";
    const 向量维度 = 768;

    // 测试辅助：生成随机向量
    const 生成随机向量 = (dim: number): number[] =>
        Array.from({ length: dim }, () => Math.random() * 2 - 1);

    beforeAll(async () => {
        // 确保普通测试集合存在
        await postAPI("/api/vector/collections/build", {
            collection_name: 普通集合名,
            dimension: 向量维度,
        });
        // 确保 embedding 集合存在（通过查询触发创建）
        await postAPI("/api/vector/collections/build", {
            collection_name: blocks集合名,
            dimension: 向量维度,
        });
    });

    afterAll(async () => {
        // 清理测试数据
        try {
            const keysRes = await postAPI<string[]>("/api/vector/keys", {
                collection_name: 普通集合名,
                with_meta: false,
            });
            if (keysRes.code === 0 && Array.isArray(keysRes.data) && keysRes.data.length > 0) {
                await postAPI("/api/vector/delete", {
                    collection_name: 普通集合名,
                    ids: keysRes.data,
                });
            }
        } catch {
            // 忽略清理错误
        }
    });

    describe("普通集合操作（应该允许）", () => {
        it("应该允许向普通集合添加向量", async () => {
            const res = await postAPI<{ added_count: number }>("/api/vector/add", {
                collection_name: 普通集合名,
                points: [
                    { id: "test_1", vector: 生成随机向量(向量维度) },
                    { id: "test_2", vector: 生成随机向量(向量维度) },
                ],
            });

            expect(res.code).toBe(0);
            expect(res.data?.added_count).toBe(2);
            console.log("✓ 普通集合添加向量成功");
        });

        it("应该允许从普通集合删除向量", async () => {
            const res = await postAPI<{ deleted_count: number }>("/api/vector/delete", {
                collection_name: 普通集合名,
                ids: ["test_1"],
            });

            expect(res.code).toBe(0);
            expect(res.data?.deleted_count).toBe(1);
            console.log("✓ 普通集合删除向量成功");
        });
    });

    describe("blocks_embedding 集合保护（应该拒绝）", () => {
        it("应该拒绝通过 /api/vector/add 向 blocks_embedding 集合添加", async () => {
            const res = await postAPI("/api/vector/add", {
                collection_name: blocks集合名,
                points: [{ id: "hack_attempt", vector: 生成随机向量(向量维度) }],
            });

            expect(res.code).toBe(403);
            expect(res.msg).toContain("Embedding");
            console.log(`✓ blocks_embedding 添加被拒绝: ${res.msg}`);
        });

        it("应该拒绝通过 /api/vector/delete 从 blocks_embedding 集合删除", async () => {
            const res = await postAPI("/api/vector/delete", {
                collection_name: blocks集合名,
                ids: ["any_id"],
            });

            expect(res.code).toBe(403);
            expect(res.msg).toContain("Embedding");
            console.log(`✓ blocks_embedding 删除被拒绝: ${res.msg}`);
        });
    });

    describe("assets_embedding 集合保护（应该拒绝）", () => {
        it("应该拒绝通过 /api/vector/add 向 assets_embedding 集合添加", async () => {
            const res = await postAPI("/api/vector/add", {
                collection_name: assets集合名,
                points: [{ id: "hack_attempt", vector: 生成随机向量(向量维度) }],
            });

            expect(res.code).toBe(403);
            expect(res.msg).toContain("Embedding");
            console.log(`✓ assets_embedding 添加被拒绝: ${res.msg}`);
        });

        it("应该拒绝通过 /api/vector/delete 从 assets_embedding 集合删除", async () => {
            const res = await postAPI("/api/vector/delete", {
                collection_name: assets集合名,
                ids: ["any_id"],
            });

            expect(res.code).toBe(403);
            expect(res.msg).toContain("Embedding");
            console.log(`✓ assets_embedding 删除被拒绝: ${res.msg}`);
        });
    });

    describe("查询操作（应该允许）", () => {
        it("应该允许查询 blocks_embedding 集合", async () => {
            const res = await postAPI("/api/vector/query", {
                collection_name: blocks集合名,
                vector: 生成随机向量(向量维度),
                top_k: 5,
            });

            // 集合可能不存在或为空，只要不是 403 就表示查询没被保护限制
            expect(res.code).not.toBe(403);
            console.log(`✓ blocks_embedding 查询允许, code: ${res.code}`);
        });

        it("应该允许获取 blocks_embedding 集合状态", async () => {
            const res = await postAPI("/api/vector/state", {
                collection_name: blocks集合名,
            });

            // 只要不是 403
            expect(res.code).not.toBe(403);
            console.log(`✓ blocks_embedding 状态查询允许, code: ${res.code}`);
        });
    });

    describe("创建集合保护（应该拒绝专用名称）", () => {
        it("应该拒绝创建 blocks_embedding_ 前缀的集合", async () => {
            const res = await postAPI("/api/vector/collections/build", {
                collection_name: "blocks_embedding_hacked",
                dimension: 256,
            });

            expect(res.code).toBe(403);
            console.log(`✓ 创建 blocks_embedding_ 集合被拒绝: ${res.msg}`);
        });

        it("应该拒绝创建 assets_embedding_ 前缀的集合", async () => {
            const res = await postAPI("/api/vector/collections/build", {
                collection_name: "assets_embedding_hacked",
                dimension: 256,
            });

            expect(res.code).toBe(403);
            console.log(`✓ 创建 assets_embedding_ 集合被拒绝: ${res.msg}`);
        });

        it("应该允许创建普通名称的集合", async () => {
            const res = await postAPI("/api/vector/collections/build", {
                collection_name: "test_allowed_collection",
                dimension: 128,
            });

            expect(res.code).toBe(0);
            console.log(`✓ 普通集合创建允许`);
        });
    });

    describe("删除集合API测试", () => {
        it("应该拒绝删除 embedding 专用集合", async () => {
            const res = await postAPI("/api/vector/collections/delete", {
                collection_name: blocks集合名,
            });

            expect(res.code).toBe(403);
            console.log(`✓ 删除 embedding 集合被拒绝: ${res.msg}`);
        });

        it("应该允许删除普通集合", async () => {
            // 先确保集合存在
            await postAPI("/api/vector/collections/build", {
                collection_name: "test_delete_me",
                dimension: 64,
            });

            const res = await postAPI("/api/vector/collections/delete", {
                collection_name: "test_delete_me",
            });

            expect(res.code).toBe(0);
            console.log(`✓ 普通集合删除成功`);
        });
    });
});
