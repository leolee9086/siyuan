/**
 * 向量API性能测试
 * 测试万级向量的增删改查性能
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// =========== 辅助类型 ===========
interface VectorPoint {
    id: string;
    vector: number[];
    meta?: Record<string, unknown>;
}

interface QueryResult {
    id: string;
    score: number;
    meta?: Record<string, unknown>;
}

interface CollectionState {
    name: string;
    dimension: number;
    item_count: number;
    max_layer: number;
}

interface APIResponse<T = unknown> {
    code: number;
    msg?: string;
    data?: T;
}

// =========== 测试用 API 封装（使用原生 fetch） ===========

const API_BASE = "http://127.0.0.1:6806";

const postAPI = async <T>(path: string, body: unknown): Promise<APIResponse<T>> => {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return res.json();
};

const 创建集合 = async (集合名称: string, 向量维度: number): Promise<void> => {
    const res = await postAPI("/api/vector/collections/build", {
        collection_name: 集合名称,
        dimension: 向量维度,
    });
    if (res.code !== 0) {
        throw new Error(res.msg || "创建集合失败");
    }
};

const 添加向量 = async (集合名称: string, 向量点列表: VectorPoint[]): Promise<number> => {
    const res = await postAPI<{ added_count: number }>("/api/vector/add", {
        collection_name: 集合名称,
        points: 向量点列表.map(p => ({
            id: p.id,
            vector: Array.from(p.vector),
            meta: p.meta,
        })),
    });
    if (res.code !== 0) {
        throw new Error(res.msg || "添加向量失败");
    }
    return res.data?.added_count ?? 0;
};

const 查询向量 = async (
    集合名称: string,
    查询向量: number[],
    返回数量 = 10,
    efSearch = 0
): Promise<QueryResult[]> => {
    const res = await postAPI<QueryResult[]>("/api/vector/query", {
        collection_name: 集合名称,
        vector: 查询向量,
        top_k: 返回数量,
        ef_search: efSearch,
    });
    if (res.code !== 0) {
        throw new Error(res.msg || "查询向量失败");
    }
    return res.data ?? [];
};

const 获取集合状态 = async (集合名称: string): Promise<CollectionState> => {
    const res = await postAPI<CollectionState>("/api/vector/state", {
        collection_name: 集合名称,
    });
    if (res.code !== 0) {
        throw new Error(res.msg || "获取状态失败");
    }
    return res.data!;
};

const 删除集合 = async (集合名称: string): Promise<void> => {
    const res = await postAPI("/api/vector/collections/delete", {
        collection_name: 集合名称,
    });
    if (res.code !== 0) {
        // 集合不存在也算成功
        if (res.msg?.includes("not found") || res.msg?.includes("不存在")) {
            return;
        }
        throw new Error(res.msg || "删除集合失败");
    }
};

// =========== 辅助函数 ===========

/**
 * 生成随机向量
 */
const 生成随机向量 = (维度: number): number[] => {
    const 向量: number[] = [];
    for (let i = 0; i < 维度; i++) {
        向量.push(Math.random() * 2 - 1);
    }
    return 向量;
};

/**
 * 分批添加向量
 */
const 分批添加 = async (
    集合名: string,
    向量维度: number,
    向量总数: number,
    批次大小: number,
    onProgress?: (已添加: number, 总数: number) => void
): Promise<{ 耗时Ms: number; 总数: number }> => {
    const 开始时间 = performance.now();
    let 已添加 = 0;

    for (let 批次 = 0; 批次 < Math.ceil(向量总数 / 批次大小); 批次++) {
        const 本批向量: VectorPoint[] = [];
        const 本批数量 = Math.min(批次大小, 向量总数 - 已添加);

        for (let i = 0; i < 本批数量; i++) {
            本批向量.push({
                id: `vec_${已添加 + i}`,
                vector: 生成随机向量(向量维度),
                meta: { index: 已添加 + i, batch: 批次 },
            });
        }

        await 添加向量(集合名, 本批向量);
        已添加 += 本批数量;
        onProgress?.(已添加, 向量总数);
    }

    return {
        耗时Ms: performance.now() - 开始时间,
        总数: 已添加,
    };
};

/**
 * 执行多次查询测试
 */
const 批量查询测试 = async (
    集合名: string,
    向量维度: number,
    查询次数: number,
    每次返回: number
): Promise<{ 总耗时Ms: number; 平均耗时Ms: number; QPS: number }> => {
    const 开始时间 = performance.now();

    for (let i = 0; i < 查询次数; i++) {
        const 查询向量Data = 生成随机向量(向量维度);
        await 查询向量(集合名, 查询向量Data, 每次返回);
    }

    const 总耗时 = performance.now() - 开始时间;
    return {
        总耗时Ms: 总耗时,
        平均耗时Ms: 总耗时 / 查询次数,
        QPS: 查询次数 / (总耗时 / 1000),
    };
};

// =========== 测试用例 ===========

describe("向量API性能测试 - 万级向量", () => {
    const 集合名 = "test_10k_vectors";
    const 向量维度 = 384;
    const 向量总数 = 10000;
    const 批次大小 = 500;

    beforeAll(async () => {
        // 清理可能存在的旧集合
        try {
            await 删除集合(集合名);
        } catch {
            // 忽略错误
        }
    });

    afterAll(async () => {
        // 清理测试集合
        try {
            await 删除集合(集合名);
        } catch {
            // 忽略错误
        }
    });

    it("应该能创建集合", async () => {
        const 开始 = performance.now();
        await 创建集合(集合名, 向量维度);
        const 耗时 = performance.now() - 开始;

        console.log(`创建集合耗时: ${耗时.toFixed(2)}ms`);
        expect(耗时).toBeLessThan(5000); // 5秒内完成
    });

    it("应该能分批添加10000个向量", async () => {
        const 结果 = await 分批添加(
            集合名,
            向量维度,
            向量总数,
            批次大小,
            (已添加, 总数) => {
                console.log(`添加进度: ${已添加}/${总数}`);
            }
        );

        console.log(`添加 ${结果.总数} 个向量耗时: ${结果.耗时Ms.toFixed(2)}ms`);
        console.log(`平均每向量: ${(结果.耗时Ms / 结果.总数).toFixed(4)}ms`);

        expect(结果.总数).toBe(向量总数);
    }, 120000); // 2分钟超时

    it("应该能获取正确的集合状态", async () => {
        const 状态 = await 获取集合状态(集合名);

        console.log("集合状态:", 状态);

        expect(状态.item_count).toBe(向量总数);
        expect(状态.dimension).toBe(向量维度);
    });

    it("应该能执行100次查询", async () => {
        const 查询次数 = 100;
        const 每次返回 = 10;

        const 结果 = await 批量查询测试(集合名, 向量维度, 查询次数, 每次返回);

        console.log(`${查询次数}次查询总耗时: ${结果.总耗时Ms.toFixed(2)}ms`);
        console.log(`平均每次: ${结果.平均耗时Ms.toFixed(2)}ms`);
        console.log(`QPS: ${结果.QPS.toFixed(2)}`);

        // 基本性能指标：平均查询应该在100ms以内（包含网络延迟）
        expect(结果.平均耗时Ms).toBeLessThan(100);
    }, 60000); // 1分钟超时

    it("单次查询应该返回正确格式的结果", async () => {
        const 查询向量Data = 生成随机向量(向量维度);
        const 开始 = performance.now();
        const 结果 = await 查询向量(集合名, 查询向量Data, 5);
        const 耗时 = performance.now() - 开始;

        console.log(`单次查询耗时: ${耗时.toFixed(2)}ms`);
        console.log("Top 5 结果:", 结果);

        expect(结果).toHaveLength(5);
        expect(结果[0]).toHaveProperty("id");
        expect(结果[0]).toHaveProperty("score");
    });
});

describe("向量API性能测试 - 高维向量 (1024维)", () => {
    const 集合名 = "test_1024dim_vectors";
    const 向量维度 = 1024;
    const 向量总数 = 5000; // 高维向量数量减少
    const 批次大小 = 200;

    beforeAll(async () => {
        try {
            await 删除集合(集合名);
        } catch {
            // 忽略错误
        }
    });

    afterAll(async () => {
        try {
            await 删除集合(集合名);
        } catch {
            // 忽略错误
        }
    });

    it("应该能创建1024维集合", async () => {
        await 创建集合(集合名, 向量维度);
        const 状态 = await 获取集合状态(集合名);
        expect(状态.dimension).toBe(向量维度);
    });

    it("应该能添加5000个1024维向量", async () => {
        const 结果 = await 分批添加(
            集合名,
            向量维度,
            向量总数,
            批次大小,
            (已添加, 总数) => {
                if (已添加 % 1000 === 0) {
                    console.log(`高维向量添加进度: ${已添加}/${总数}`);
                }
            }
        );

        console.log(`添加 ${结果.总数} 个1024维向量耗时: ${结果.耗时Ms.toFixed(2)}ms`);
        expect(结果.总数).toBe(向量总数);
    }, 180000); // 3分钟超时

    it("高维向量查询性能测试", async () => {
        const 查询次数 = 50;
        const 结果 = await 批量查询测试(集合名, 向量维度, 查询次数, 10);

        console.log(`1024维向量 ${查询次数}次查询:`);
        console.log(`  总耗时: ${结果.总耗时Ms.toFixed(2)}ms`);
        console.log(`  平均: ${结果.平均耗时Ms.toFixed(2)}ms`);
        console.log(`  QPS: ${结果.QPS.toFixed(2)}`);

        expect(结果.平均耗时Ms).toBeLessThan(200); // 高维允许更长时间
    }, 60000);
});
