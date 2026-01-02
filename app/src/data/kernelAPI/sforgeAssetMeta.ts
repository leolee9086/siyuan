/**
 * S-Forge 素材元数据 API 封装
 *
 * 提供前端调用后端色彩提取和素材元数据管理的功能
 *
 * @module sforgeAssetMeta
 */

import { fetchSyncPost } from "../../util/fetch";
import type {
    调色板,
    素材元数据,
    批量提取单项结果,
    设置素材元数据参数,
} from "./sforgeAssetMeta.types";

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
export async function 提取调色板(path: string, colorCount = 8): Promise<调色板[]> {
    const result = await fetchSyncPost("/api/s-forge/asset-meta/palette", {
        path,
        colorCount,
    });

    if (result.code !== 0) {
        throw new Error(result.msg || "提取调色板失败");
    }

    return result.data?.palettes ?? [];
}

/** extractPalette 的英文别名 */
export const extractPalette = 提取调色板;

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
): Promise<{
    results: Record<string, 批量提取单项结果>;
    successCount: number;
    failCount: number;
}> {
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

/** batchExtractPalettes 的英文别名 */
export const batchExtractPalettes = 批量提取调色板;

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
export async function 获取素材元数据(path: string): Promise<素材元数据> {
    const result = await fetchSyncPost("/api/s-forge/asset-meta/get", { path });

    if (result.code !== 0) {
        throw new Error(result.msg || "获取素材元数据失败");
    }

    return result.data;
}

/** getAssetMeta 的英文别名 */
export const getAssetMeta = 获取素材元数据;

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
export async function 设置素材元数据(params: 设置素材元数据参数): Promise<素材元数据> {
    const result = await fetchSyncPost("/api/s-forge/asset-meta/set", { ...params });

    if (result.code !== 0) {
        throw new Error(result.msg || "设置素材元数据失败");
    }

    return result.data;
}

/** setAssetMeta 的英文别名 */
export const setAssetMeta = 设置素材元数据;

// ============================================================
// 工具函数
// ============================================================

/**
 * 将 RGB 颜色转换为十六进制字符串
 *
 * @param color RGB 颜色数组 [R, G, B]
 * @returns 十六进制颜色字符串，如 "#FF8040"
 */
export function rgb转十六进制(color: [number, number, number]): string {
    return `#${color.map(c => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** rgbToHex 的英文别名 */
export const rgbToHex = rgb转十六进制;

/**
 * 将调色板数组转换为十六进制颜色数组
 *
 * @param palettes 调色板数组
 * @returns 十六进制颜色字符串数组
 */
export function 调色板转十六进制数组(palettes: 调色板[]): string[] {
    return palettes.map(p => rgb转十六进制(p.color));
}

/** palettesToHexArray 的英文别名 */
export const palettesToHexArray = 调色板转十六进制数组;

/**
 * 获取调色板中占比最高的主色调
 *
 * @param palettes 调色板数组
 * @returns 占比最高的颜色条目，如果数组为空则返回 undefined
 */
export function 获取主色调(palettes: 调色板[]): 调色板 | undefined {
    if (palettes.length === 0) {
        return undefined;
    }
    const initialMax = palettes[0];
    return palettes.reduce((max, p) => (p.ratio > max.ratio ? p : max), initialMax);
}

/** getDominantColor 的英文别名 */
export const getDominantColor = 获取主色调;
