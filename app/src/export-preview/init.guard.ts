/**
 * 导出预览页签类型守卫
 */

import { EXPORT_PREVIEW_DEFAULT_TYPE, EXPORT_PREVIEW_IMAGE_TYPE } from "./constants";
import type { IExportPreviewData } from "./init.types";

/** @同步豁免: 类型守卫 */
export const isExportPreviewData = (data: unknown): data is IExportPreviewData => {
    if (typeof data !== "object" || data === null) {
        return false;
    }
    const record = data as Record<string, unknown>;
    const isValidPreviewType = typeof record.previewType === "undefined" ||
        record.previewType === EXPORT_PREVIEW_DEFAULT_TYPE ||
        record.previewType === EXPORT_PREVIEW_IMAGE_TYPE;
    return typeof record.blockId === "string" && record.blockId !== "" && isValidPreviewType;
};
