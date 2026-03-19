/**
 * 导出预览页签打开辅助
 *
 * 作用：统一打开/复用导出预览页签，并支持切换普通预览与图片预览类型
 */

import { getAllModels } from "../layout/getAll";
import { openFile } from "../editor/util";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { EXPORT_PREVIEW_DEFAULT_TYPE, EXPORT_PREVIEW_SET_TYPE_EVENT, EXPORT_PREVIEW_TAB_TYPE } from "./constants";
import type { App } from "../index";
import type { IExportPreviewData } from "./init.types";
import type { TExportPreviewType } from "./init.types";

/** 解析导出预览页签使用的 app 实例。 */
const resolveApp = (app?: App): App | undefined => {
    if (app) {
        return app;
    }
    return (window.siyuan?.ws as { app?: App } | undefined)?.app;
};

/** 读取自定义页签上的导出预览数据。 */
const readExportPreviewData = (data: unknown): Partial<IExportPreviewData> => {
    if (!data || typeof data !== "object") {
        return {};
    }
    return data as Partial<IExportPreviewData>;
};

/**
 * 打开导出预览页签。
 *
 * - 已存在相同文档的导出预览页签时，直接聚焦并切换预览类型
 * - 不存在时，新建页签并传入初始预览类型
 */
export const openExportPreviewTab = async (options: {
    blockId: string;
    app?: App;
    previewType?: TExportPreviewType;
}): Promise<void> => {
    const app = resolveApp(options.app);
    if (!app) {
        return;
    }

    const previewType = options.previewType || EXPORT_PREVIEW_DEFAULT_TYPE;
    const existingModel = getAllModels().custom.find((item) => {
        const data = readExportPreviewData(item.data);
        return item.type === EXPORT_PREVIEW_TAB_TYPE && data.blockId === options.blockId;
    });

    if (existingModel?.parent?.headElement) {
        existingModel.parent.parent.switchTab(existingModel.parent.headElement);
        existingModel.parent.parent.showHeading();
        existingModel.element.dispatchEvent(new CustomEvent(EXPORT_PREVIEW_SET_TYPE_EVENT, {
            detail: { previewType },
        }));
        return;
    }

    await openFile({
        app,
        custom: {
            title: siyuanI18n.preview,
            icon: "iconPreview",
            id: EXPORT_PREVIEW_TAB_TYPE,
            data: {
                blockId: options.blockId,
                previewType,
            },
        },
    });
};
