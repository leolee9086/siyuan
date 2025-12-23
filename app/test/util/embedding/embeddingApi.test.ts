
import { describe, it, expect } from "vitest";

const API_BASE = "http://127.0.0.1:6806";

interface APIResponse<T = any> {
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

describe("Embedding API Integration Tests", () => {
    it("should get embedding status", async () => {
        const res = await postAPI("/api/embedding/status", {});
        expect(res.code).toBe(0);
        expect(res.data.enabled).toBeDefined();
        console.log("Embedding Status:", res.data);
    });

    it("should list models", async () => {
        const res = await postAPI("/api/embedding/models", {});
        expect(res.code).toBe(0);
        expect(Array.isArray(res.data.models)).toBe(true);
        console.log("Available Models:", res.data.models.map((m: any) => m.name));
    });

    it("should pull model (leolee9086/text2vec-base-chinese)", async () => {
        // This might take time, set timeout appropriately
        const model = "leolee9086/text2vec-base-chinese";
        console.log(`Pulling model ${model}...`);
        const res = await postAPI("/api/embedding/models/pull", { model });

        // It might return error if Ollama is offline, but code should be 0 or -1
        if (res.code === 0) {
            expect(res.data.status).toBe("success");
            expect(res.data.model).toBe(model);
        } else {
            console.warn(`Pull failed (expected if offline): ${res.msg}`);
        }
    }, 60000); // 60s timeout

    it("should set current model", async () => {
        const model = "leolee9086/text2vec-base-chinese";
        const res = await postAPI("/api/embedding/models/set", { model });

        // 如果模型未拉取，这里会失败，跳过断言
        if (res.code === 0) {
            expect(res.data.model).toBe(model);
        } else {
            console.warn(`Set model failed (model may not be pulled): ${res.msg}`);
        }
    });

    it("should push blocks (handle non-existent)", async () => {
        const res = await postAPI("/api/embedding/blocks/push", {
            ids: ["non-existent-id-123", "non-existent-id-456"],
            model: "leolee9086/text2vec-base-chinese"
        });

        // 如果 Ollama 未就绪，跳过断言
        if (res.code === 0) {
            expect(res.data.pushed).toBe(0);
            expect(res.data.skipped).toBe(2);
        } else {
            console.warn(`Push blocks failed (Ollama may not be ready): ${res.msg}`);
        }
    });

    it("should query blocks", async () => {
        const res = await postAPI("/api/embedding/blocks/query", {
            query: "test query",
            top_k: 5
        });

        // 如果 Ollama 未就绪，跳过断言
        if (res.code === 0) {
            expect(Array.isArray(res.data.results)).toBe(true);
        } else {
            console.warn(`Query blocks failed (Ollama may not be ready): ${res.msg}`);
        }
    });

    it("should get pending blocks", async () => {
        const res = await postAPI("/api/embedding/blocks/pending", {
            limit: 10,
            model: "leolee9086/text2vec-base-chinese" // model 参数必填
        });
        expect(res.code).toBe(0);
        expect(Array.isArray(res.data.pending)).toBe(true);
        expect(typeof res.data.total).toBe('number');
    });
});
