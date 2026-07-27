/** 用途：导出流程常量；使用范围：读取 LOCAL_EXPORTIMG；解耦评估：集中常量依赖，禁止硬编码替代。 */
import {Constants} from "./imports";
/** 用途：全局存储访问；使用范围：读取与修复导出图片配置；解耦评估：通过 environment 封装已消除业务层 window 耦合。 */
import {getSafeSiyuanStorage} from "./imports";
/** 用途：导出图片存储类型；使用范围：返回值与默认值约束；解耦评估：类型依赖不引入运行时耦合。 */
import type {IExportImageStorage} from "./exportImage.types";
/** 用途：导出比例规范化；使用范围：修复历史存储中的 ratio 字段；解耦评估：比例规则集中维护优于在存储层重复硬编码。 */
import {normalizeExportImageRatio} from "./exportImage.ratio";

/**
 * 作用：生成导出图片配置默认值。
 * 意图：保证配置缺失时仍可安全运行导出流程。
 * 调用时机：存储不存在或字段无效时。
 * 问题/改进：新增配置字段时需同步扩展默认值。
 */
const createDefaultStorage = (): IExportImageStorage => ({keepFold: false, watermark: false, ratio: "auto", background: ""});

/**
 * 作用：把未知值规范为布尔值。
 * 意图：兼容历史脏数据（字符串/数字）并统一存储语义。
 * 调用时机：解析 LOCAL_EXPORTIMG 字段时。
 * 问题/改进：当前仅覆盖常见场景，后续若出现新格式需补充映射。
 */
const normalizeBoolean = (value: unknown, fallback: boolean): boolean => {
    // 仅布尔值可直接信任。
    if (typeof value === "boolean") {
        return value;
    }
    // 字符串场景来自历史手工配置或第三方写入。
    if (value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }
    // 数值场景保持向后兼容：1=true, 0=false。
    if (value === 1) {
        return true;
    }
    if (value === 0) {
        return false;
    }
    return fallback;
};

/**
 * 作用：把未知值规范为字符串。
 * 意图：兼容历史脏数据并统一背景样式字段语义。
 * 调用时机：解析 LOCAL_EXPORTIMG 字段时。
 */
const normalizeString = (value: unknown, fallback: string): string => {
    return typeof value === "string" ? value : fallback;
};

/**
 * 作用：读取并规范化导出图片配置。
 * 意图：彻底消除配置格式漂移风险，避免“只校验部分字段”的技术债。
 * 调用时机：导出图片上下文初始化前。
 * 问题/改进：后续若字段增多，可升级为 schema 驱动的通用规范化器。
 */
// 导出语句注释：导出图片配置读取入口。
export const getExportImageStorage = async (): Promise<IExportImageStorage> => {
    const storage = getSafeSiyuanStorage();
    if (!storage) {
        return createDefaultStorage();
    }

    const rawValue = storage[Constants.LOCAL_EXPORTIMG];
    const defaultStorage = createDefaultStorage();
    const keepFold = rawValue ? Reflect.get(rawValue, "keepFold") : undefined;
    const watermark = rawValue ? Reflect.get(rawValue, "watermark") : undefined;
    const ratio = rawValue ? Reflect.get(rawValue, "ratio") : undefined;
    const background = rawValue ? Reflect.get(rawValue, "background") : undefined;
    const normalizedStorage: IExportImageStorage = {
        keepFold: normalizeBoolean(keepFold, defaultStorage.keepFold),
        watermark: normalizeBoolean(watermark, defaultStorage.watermark),
        ratio: await normalizeExportImageRatio(ratio, defaultStorage.ratio),
        background: normalizeString(background, defaultStorage.background),
    };
    storage[Constants.LOCAL_EXPORTIMG] = normalizedStorage;
    return normalizedStorage;
};
