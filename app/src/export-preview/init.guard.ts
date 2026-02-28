/**
 * 导出预览页签类型守卫
 */

import type { IExportPreviewData } from "./init.types";

/** @同步豁免: 类型守卫 */
export const isExportPreviewData = (data: unknown): data is IExportPreviewData => {
    if (typeof data !== "object" || data === null) {
        return false;
    }
    const record = data as Record<string, unknown>;
    return typeof record.blockId === "string" && record.blockId !== "";
};
