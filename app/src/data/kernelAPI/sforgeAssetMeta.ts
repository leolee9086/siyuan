/**
 * S-Forge 素材元数据 API 封装
 *
 * 提供前端调用后端色彩提取和素材元数据管理的功能
 *
 * @module sforgeAssetMeta
 */

/** 用途：同步 POST 请求函数。使用范围：sforgeAssetMeta 调用后端元数据 API。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "./imports";
/** 用途：调色板类型定义。使用范围：sforgeAssetMeta 色彩提取。解耦评估：同目录类型文件，直接同层导入。 */
import type { 调色板 } from "./sforgeAssetMeta.types";
/** 用途：素材元数据类型定义。使用范围：sforgeAssetMeta 元数据管理。解耦评估：同目录类型文件。 */
import type { 素材元数据 } from "./sforgeAssetMeta.types";
/** 用途：批量提取结果类型。使用范围：sforgeAssetMeta 批量处理。解耦评估：同目录类型文件。 */
import type { 批量提取单项结果 } from "./sforgeAssetMeta.types";
/** 用途：设置元数据参数类型。使用范围：sforgeAssetMeta 写入操作。解耦评估：同目录类型文件。 */
import type { 设置素材元数据参数 } from "./sforgeAssetMeta.types";
/** 用途：搜索元数据参数类型。使用范围：sforgeAssetMeta 搜索操作。解耦评估：同目录类型文件。 */
import type { 搜索素材元数据参数 } from "./sforgeAssetMeta.types";
/** 用途：搜索元数据响应类型。使用范围：sforgeAssetMeta 搜索操作。解耦评估：同目录类型文件。 */
import type { 搜索素材元数据响应 } from "./sforgeAssetMeta.types";

// 导出类型
export type {
    调色板,
    Palette,
    素材元数据,
    AssetMeta,
    批量提取单项结果,
    BatchExtractResult,
    设置素材元数据参数,
    SetAssetMetaParams,
    搜索素材元数据参数,
    SearchAssetMetaParams,
    搜索素材元数据响应,
    SearchAssetMetaResponse,
} from "./sforgeAssetMeta.types";

// ============================================================
// API 封装函数
// ============================================================

/**
 * 提取素材调色板
 *
 * 调用后端 MMCQ 算法提取图像主色调，并自动保存到素材元数据中
 *
 * @param path 相对于 data/ 的路径，如 "assets/xxx.png"
 * @param colorCount 目标颜色数量，默认 8，最大 16
 * @returns 提取的调色板数组
 *
 * @example
 * ```ts
 * const palettes = await 提取调色板("assets/image.png", 8);
 * console.log(palettes[0].color); // [255, 128, 64]
 * console.log(palettes[0].ratio); // 0.35
 * ```
 */
export async function 提取调色板(path: string, colorCount = 8) {
    const result = await fetchSyncPost("/api/s-forge/asset-meta/palette", {
        path,
        colorCount,
    });

    if (result.code !== 0) {
        throw new Error(result.msg || "提取调色板失败");
    }

    return result.data?.palettes ?? [];
}

/**
 * 批量提取素材调色板
 *
 * 对多个图像批量提取主色调，每个结果会自动保存到对应素材的元数据中
 *
 * @param paths 相对于 data/ 的路径数组，最多 100 个
 * @param colorCount 目标颜色数量，默认 8，最大 16
 * @returns 包含每个路径结果的映射，以及成功/失败计数
 *
 * @example
 * ```ts
 * const result = await 批量提取调色板(["assets/a.png", "assets/b.jpg"], 8);
 * console.log(result.results["assets/a.png"].palettes);
 * console.log(result.successCount, result.failCount);
 * ```
 */
export async function 批量提取调色板(
    paths: string[],
    colorCount = 8
) {
    const result = await fetchSyncPost("/api/s-forge/asset-meta/palette/batch", {
        paths,
        colorCount,
    });

    if (result.code !== 0) {
        throw new Error(result.msg || "批量提取调色板失败");
    }

    return {
        results: result.data?.results ?? {},
        successCount: result.data?.successCount ?? 0,
        failCount: result.data?.failCount ?? 0,
    };
}

/**
 * 获取素材元数据
 *
 * @param path 相对于 data/ 的路径
 * @returns 素材元数据，如果不存在则抛出错误
 *
 * @example
 * ```ts
 * const meta = await 获取素材元数据("assets/image.png");
 * console.log(meta.name, meta.tags, meta.palettes);
 * ```
 */
export async function 获取素材元数据(path: string) {
    const result = await fetchSyncPost("/api/s-forge/asset-meta/get", { path });

    if (result.code !== 0) {
        throw new Error(result.msg || "获取素材元数据失败");
    }

    return result.data;
}

/**
 * 设置素材元数据
 *
 * 更新素材的名称、标签、星级或注释
 *
 * @param params 要设置的元数据字段
 * @returns 更新后的完整素材元数据
 *
 * @example
 * ```ts
 * await 设置素材元数据({
 *     path: "assets/image.png",
 *     name: "新名称",
 *     tags: ["设计", "图标"],
 *     star: 5,
 *     annotation: "这是一个重要素材"
 * });
 * ```
 */
export async function 设置素材元数据(params: 设置素材元数据参数) {
    const result = await fetchSyncPost("/api/s-forge/asset-meta/set", { ...params });

    if (result.code !== 0) {
        throw new Error(result.msg || "设置素材元数据失败");
    }

    return result.data;
}

/**
 * 搜索素材元数据 (高级搜索)
 *
 * 支持多条件组合过滤搜索，包括尺寸、大小、星级、颜色等
 *
 * @param params 搜索参数
 * @returns 搜索结果
 *
 * @example
 * ```ts
 * const result = await 搜索素材元数据({
 *     keyword: "design",
 *     minWidth: 1000,
 *     minStar: 4,
 *     exts: [".png", ".jpg"]
 * });
 * console.log(result.assets);
 * console.log(result.totalCount);
 * ```
 */
export async function 搜索素材元数据(params: 搜索素材元数据参数) {
    const result = await fetchSyncPost("/api/s-forge/asset-meta/search", { ...params });

    if (result.code !== 0) {
        throw new Error(result.msg || "搜索素材元数据失败");
    }

    return result.data;
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 将 RGB 颜色转换为十六进制字符串
 * @同步豁免: 性能考虑 - 纯内存计算函数，无 I/O 操作，异步化会增加不必要的开销
 *
 * @param color RGB 颜色数组 [R, G, B]
 * @returns 十六进制颜色字符串，如 "#FF8040"
 */
export function rgb转十六进制(color: [number, number, number]) {
    return `#${color.map(c => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * 获取调色板中占比最高的主色调
 * @同步豁免: 性能考虑 - 纯内存计算函数，无 I/O 操作，异步化会增加不必要的开销
 *
 * @param palettes 调色板数组
 * @returns 占比最高的颜色条目，如果数组为空则返回 undefined
 */
export function 获取主色调(palettes: 调色板[]) {
    const [first, ...rest] = palettes;
    if (!first) {
        return undefined;
    }
    // 使用解构获取第一个元素，TypeScript 可正确推断类型
    return rest.reduce((max, p) => (p.ratio > max.ratio ? p : max), first);
}
