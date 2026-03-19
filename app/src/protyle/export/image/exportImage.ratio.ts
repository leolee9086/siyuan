/** 用途：导出图片上下文类型；使用范围：比例预览与分页导出流程；解耦评估：仅类型依赖，不引入运行时耦合。 */
import type {IExportImageContext} from "./exportImage.types";
/** 用途：导出图片比例选项类型；使用范围：比例常量项的字段约束；解耦评估：类型集中管理可减少同类声明散落。 */
import type {IExportImageRatioOption} from "./exportImage.types";
/** 用途：自动模式值；使用范围：存储默认值与下拉选项。 */
export const EXPORT_IMAGE_RATIO_AUTO = "auto";
/** 用途：比例选项常量；使用范围：弹窗渲染、存储校验与导出分页。 */
export const EXPORT_IMAGE_RATIO_OPTIONS: IExportImageRatioOption[] = [
    {value: EXPORT_IMAGE_RATIO_AUTO, label: "自动"},
    {value: "1/1", label: "1:1"},
    {value: "4/3", label: "4:3"},
    {value: "3/4", label: "3:4"},
    {value: "16/9", label: "16:9"},
    {value: "9/16", label: "9:16"},
    {value: "3/2", label: "3:2"},
    {value: "2/3", label: "2:3"},
    {value: "16/10", label: "16:10 (平板/笔记本)"},
    {value: "10/16", label: "10:16 (平板竖屏)"},
    {value: "9/19.5", label: "9:19.5 (iPhone 竖屏)"},
    {value: "9/20", label: "9:20 (Android 竖屏)"},
    {value: "19.5/9", label: "19.5:9 (iPhone 横屏)"},
    {value: "20/9", label: "20:9 (Android 横屏)"},
];
/** 用途：合法比例值集合；使用范围：本地存储纠偏。 */
const EXPORT_IMAGE_RATIO_VALUE_SET = new Set(EXPORT_IMAGE_RATIO_OPTIONS.map((option) => option.value));
/**
 * 作用：构建比例下拉框选项 HTML。
 * 意图：把选项模板收敛到单点，避免弹窗模板中散落硬编码。
 * 调用时机：创建导出图片弹窗时。
 * 问题/改进：后续若接入 i18n，可在这里集中替换 label 来源。
 */
export const buildExportImageRatioOptionsHtml = async (selectedRatio: string): Promise<string> => {
    return EXPORT_IMAGE_RATIO_OPTIONS.map((option) => {
        const selected = option.value === selectedRatio ? " selected" : "";
        return `<option value="${option.value}"${selected}>${option.label}</option>`;
    }).join("");
};
/**
 * 作用：把未知值规范为受支持的比例选项。
 * 意图：兼容历史存储缺失或脏数据，避免下拉框出现非法状态。
 * 调用时机：读取 LOCAL_EXPORTIMG 配置时。
 * 问题/改进：如果未来选项量显著增加，可升级为 schema 校验器。
 */
export const normalizeExportImageRatio = async (value: unknown, fallback = EXPORT_IMAGE_RATIO_AUTO): Promise<string> => {
    if (typeof value !== "string") {
        return fallback;
    }
    if (!EXPORT_IMAGE_RATIO_VALUE_SET.has(value)) {
        return fallback;
    }
    return value;
};
/**
 * 作用：解析比例字符串为宽高数值。
 * 意图：为预览高度计算和分页导出提供统一的比例解析结果。
 * 调用时机：比例切换与确认导出时。
 * 问题/改进：当前仅支持 `宽/高` 结构，未来可扩展特殊模式值。
 */
export const parseExportImageRatio = async (value: string): Promise<{width: number; height: number} | undefined> => {
    if (!value || EXPORT_IMAGE_RATIO_AUTO === value || !value.includes("/")) {
        return undefined;
    }

    const [widthText, heightText] = value.split("/");
    const width = Number.parseFloat(widthText);
    const height = Number.parseFloat(heightText);
    if (!(width > 0) || !(height > 0)) {
        return undefined;
    }
    return {width, height};
};
/**
 * 作用：把当前比例应用到导出预览容器。
 * 意图：在不裁切内容的前提下，提前给用户一个“最小画布比例”的视觉反馈。
 * 调用时机：预览渲染完成后、比例下拉框切换后。
 * 问题/改进：当前为顶部对齐，后续可增加垂直居中预览策略。
 */
export const applyExportImageRatioPreview = async (ctx: Pick<IExportImageContext, "exportImageElement" | "ratioElement">): Promise<void> => {
    ctx.exportImageElement.style.removeProperty("min-height");

    const ratio = await parseExportImageRatio(ctx.ratioElement.value);
    if (!ratio) {
        return;
    }
    const width = Math.ceil(ctx.exportImageElement.getBoundingClientRect().width);
    if (width <= 0) {
        return;
    }

    const height = Math.max(1, Math.ceil(width * ratio.height / ratio.width));
    ctx.exportImageElement.style.minHeight = `${height}px`;
};
