/**
 * 导出预览页签类型守卫
 */

/** 用途：导出预览默认类型常量。使用范围：导出预览页签类型守卫。解耦评估：常量导入，不涉及运行时耦合。 */
import { EXPORT_PREVIEW_DEFAULT_TYPE } from "./constants";
/** 用途：导出预览图片类型常量。使用范围：导出预览页签类型守卫。解耦评估：常量导入，不涉及运行时耦合。 */
import { EXPORT_PREVIEW_IMAGE_TYPE } from "./constants";
/** 用途：导出预览微信公众号类型常量。使用范围：导出预览页签类型守卫。解耦评估：常量导入，不涉及运行时耦合。 */
import { EXPORT_PREVIEW_MP_WECHAT_TYPE } from "./constants";
/** 用途：导出预览语雀类型常量。使用范围：导出预览页签类型守卫。解耦评估：常量导入，不涉及运行时耦合。 */
import { EXPORT_PREVIEW_YUQUE_TYPE } from "./constants";
/** 用途：导出预览知乎类型常量。使用范围：导出预览页签类型守卫。解耦评估：常量导入，不涉及运行时耦合。 */
import { EXPORT_PREVIEW_ZHIHU_TYPE } from "./constants";
/** 用途：导出预览数据类型。使用范围：类型守卫返回值类型标注。解耦评估：类型导入，不涉及运行时耦合。 */
import type { IExportPreviewData } from "./init.types";

/** @同步豁免: 类型守卫 */
export const isExportPreviewData = (data: unknown): data is IExportPreviewData => {
    if (typeof data !== "object" || data === null) {
        return false;
    }
    const record = data as Record<string, unknown>;
    const isValidPreviewType = typeof record.previewType === "undefined" ||
        record.previewType === EXPORT_PREVIEW_DEFAULT_TYPE ||
        record.previewType === EXPORT_PREVIEW_IMAGE_TYPE ||
        record.previewType === EXPORT_PREVIEW_MP_WECHAT_TYPE ||
        record.previewType === EXPORT_PREVIEW_ZHIHU_TYPE ||
        record.previewType === EXPORT_PREVIEW_YUQUE_TYPE;
    return typeof record.blockId === "string" && record.blockId !== "" && isValidPreviewType;
};
