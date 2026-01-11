/**
 * 笔记内插件编译器
 * 从文档中提取 JavaScript 代码块并编译为可执行代码
 */
import { fetchSyncPost } from "../util/fetch";
import type { 编译结果 } from "./types";

/**
 * 编译文档为插件代码
 * @param docId 文档ID
 * @returns 编译结果
 */
export async function 编译文档(docId: string, docTitle?: string): Promise<编译结果> {
    try {
        // 获取文档的所有子块
        const response = await fetchSyncPost("/api/block/getChildBlocks", { id: docId });

        if (!response || response.code !== 0) {
            return {
                code: "",
                hasError: true,
                error: `获取文档内容失败: ${response?.msg || "未知错误"}`
            };
        }

        const blocks = response.data || [];
        const 代码片段: string[] = [];

        // 遍历所有块，提取 JavaScript 代码块
        for (const block of blocks) {
            if (block.type === "c") {  // 代码块类型
                const codeResult = await 提取代码块内容(block.id);
                if (codeResult) {
                    代码片段.push(codeResult);
                }
            }
        }

        if (代码片段.length === 0) {
            return {
                code: "",
                hasError: true,
                error: "文档中没有找到 JavaScript 代码块"
            };
        }

        // 拼接所有代码片段
        let finalCode = 代码片段.join("\n\n");

        // 添加 sourceURL 用于调试
        const sourceName = docTitle || docId;
        finalCode += `\n//# sourceURL=note-plugin://${docId}/${encodeURIComponent(sourceName)}`;

        return {
            code: finalCode,
            hasError: false
        };

    } catch (e) {
        return {
            code: "",
            hasError: true,
            error: e instanceof Error ? e.message : String(e)
        };
    }
}

/**
 * 提取代码块内容
 * @param blockId 代码块ID
 * @returns JavaScript 代码内容，非JS代码块返回 null
 */
async function 提取代码块内容(blockId: string): Promise<string | null> {
    try {
        const response = await fetchSyncPost("/api/block/getBlockKramdown", { id: blockId });

        if (!response || response.code !== 0 || !response.data?.kramdown) {
            return null;
        }

        const kramdown = response.data.kramdown as string;

        // 解析代码块语言和内容
        // 格式: ```language\n代码内容\n```
        const match = kramdown.match(/^```(\w*)\n([\s\S]*?)\n```/);

        if (!match) {
            return null;
        }

        const lang = match[1].toLowerCase();
        const code = match[2];

        // 只提取 JavaScript/JS 代码块
        if (lang === "javascript" || lang === "js") {
            return code;
        }

        return null;
    } catch (e) {
        console.warn(`提取代码块 ${blockId} 失败:`, e);
        return null;
    }
}

/**
 * 检查文档是否为插件定义文档
 * @param attrs 文档属性
 */
export function 是插件文档(attrs: Record<string, string>): boolean {
    return attrs["custom-ext-type"] === "plugin";
}

/**
 * 获取文档属性
 * @param docId 文档ID
 */
export async function 获取文档属性(docId: string): Promise<Record<string, string>> {
    try {
        const response = await fetchSyncPost("/api/attr/getBlockAttrs", { id: docId });
        if (response && response.code === 0 && response.data) {
            return response.data;
        }
        return {};
    } catch (e) {
        console.warn(`获取文档属性失败: ${docId}`, e);
        return {};
    }
}

/**
 * 设置文档为插件文档
 * @param docId 文档ID
 */
export async function 设置为插件文档(docId: string): Promise<boolean> {
    try {
        const response = await fetchSyncPost("/api/attr/setBlockAttrs", {
            id: docId,
            attrs: { "custom-ext-type": "plugin" }
        });
        return response && response.code === 0;
    } catch (e) {
        console.warn(`设置文档属性失败: ${docId}`, e);
        return false;
    }
}
