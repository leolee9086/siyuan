/**
 * S-Forge 素材元数据 API 类型定义
 *
 * @module sforgeAssetMeta.types
 */

// ============================================================
// 类型定义
// ============================================================

/**
 * 调色板条目
 *
 * 代表从图像中提取的一个主要颜色及其占比
 */
export interface 调色板 {
    /** RGB 颜色值 [R, G, B]，每个分量范围 0-255 */
    color: [number, number, number];
    /** 该颜色在图像中的占比，范围 0-1 */
    ratio: number;
    /** 色相值 (Hue)，范围 0-360 */
    h: number;
    /** 饱和度 (Saturation)，范围 0-100 */
    s: number;
    /** 亮度 (Lightness)，范围 0-100 */
    l: number;
}

/** Palette 的英文别名 */
export type Palette = 调色板;

/**
 * 素材元数据
 *
 * 包含素材的所有元数据信息
 */
export interface 素材元数据 {
    /** 相对于 data/ 的路径，如 "assets/xxx.png" */
    path: string;
    /** 素材显示名称 */
    name?: string;
    /** 标签列表 */
    tags?: string[];
    /** 星级评分 0-5 */
    star?: number;
    /** 注释/描述 */
    annotation?: string;
    /** 来源 (如 "eagle", "local") */
    source?: string;
    /** 来源 ID (如 Eagle 的素材 ID) */
    sourceId?: string;
    /** 导入时间戳 (Unix 秒) */
    importTime?: number;
    /** 图片宽度 */
    width?: number;
    /** 图片高度 */
    height?: number;
    /** 文件大小 (字节) */
    fileSize?: number;
    /** 调色板 */
    palettes?: 调色板[];
    /** 绑定的思源区块 ID */
    boundBlockId?: string;
}

/** AssetMeta 的英文别名 */
export type AssetMeta = 素材元数据;

/**
 * 批量提取调色板响应中的单项结果
 */
export interface 批量提取单项结果 {
    palettes: 调色板[] | null;
    error: string;
}

/** BatchExtractResult 的英文别名 */
export type BatchExtractResult = 批量提取单项结果;

/**
 * 设置素材元数据参数
 */
export interface 设置素材元数据参数 {
    /** 相对于 data/ 的路径（必需） */
    path: string;
    /** 素材显示名称（可选） */
    name?: string;
    /** 标签列表（可选） */
    tags?: string[];
    /** 星级评分 0-5（可选） */
    star?: number;
    /** 注释/描述（可选） */
    annotation?: string;
}

/** SetAssetMetaParams 的英文别名 */
export type SetAssetMetaParams = 设置素材元数据参数;
