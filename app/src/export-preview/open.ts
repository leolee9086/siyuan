/**
 * 导出预览页签打开辅助
 *
 * 作用：统一打开/复用导出预览页签，并支持切换普通预览与图片预览类型
 */

/** 用途：获取所有打开的模型实例。使用范围：export-preview 查找已有页签。解耦评估：通过 imports.ts 转发。 */
import { getAllModels } from "./imports";
/** 用途：国际化文本资源。使用范围：export-preview 设置页签标题。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：导出预览默认类型和事件常量。使用范围：open.ts 页签操作。解耦评估：同目录常量，直接同层导入。 */
import { EXPORT_PREVIEW_DEFAULT_TYPE } from "./constants";
/** 用途：导出预览设置类型事件名。使用范围：open.ts 通知切换预览类型。解耦评估：同目录常量，直接同层导入。 */
import { EXPORT_PREVIEW_SET_TYPE_EVENT } from "./constants";
/** 用途：导出预览页签类型标识。使用范围：open.ts 查找已有页签。解耦评估：同目录常量，直接同层导入。 */
import { EXPORT_PREVIEW_TAB_TYPE } from "./constants";
/** 用途：应用实例类型定义。使用范围：export-preview 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { AppFacade } from "./imports";
/** 用途：导出预览类型枚举。使用范围：open.ts 类型约束。解耦评估：同目录类型，直接同层导入。 */
import type { TExportPreviewType } from "./init.types";

/** 解析导出预览页签使用的 app 实例。 */
const resolveApp = (app?: AppFacade) => {
    if (app) {
        return app;
    }
    const win = document.defaultView;
    if (!win) {
        return undefined;
    }
    // "siyuan" is a runtime-injected global, use in-narrowing for safe access
    if ("siyuan" in win && win.siyuan && typeof win.siyuan === "object" && "ws" in win.siyuan) {
        const ws = win.siyuan.ws;
        const app = ws && typeof ws === "object" && "app" in ws ? ws.app : undefined;
        return app;
    }
    return undefined;
};

/** 读取自定义页签上的导出预览数据。 */
const readExportPreviewData = (data: unknown) => {
    if (!data || typeof data !== "object") {
        return {};
    }
    return {
        // Safe property access on unknown data
        blockId: typeof Reflect.get(data, "blockId") === "string" ? Reflect.get(data, "blockId") : undefined,
        previewType: typeof Reflect.get(data, "previewType") === "string" ? Reflect.get(data, "previewType") : undefined,
    };
};

/**
 * 打开导出预览页签。
 *
 * - 已存在相同文档的导出预览页签时，直接聚焦并切换预览类型
 * - 不存在时，新建页签并传入初始预览类型
 * @同步豁免: UI构建 — 操作 DOM 页签并触发事件
 */
export const openExportPreviewTab = async (options: {
    blockId: string;
    app?: AppFacade;
    previewType?: TExportPreviewType;
}) => {
    const app = resolveApp(options.app);
    if (!app) {
        return;
    }

    const previewType = options.previewType || EXPORT_PREVIEW_DEFAULT_TYPE;
    const existingModel = getAllModels().custom.find((item) => {
        const data = readExportPreviewData(item.data);
        return item.type === EXPORT_PREVIEW_TAB_TYPE && data.blockId === options.blockId;
    });

    // 如果已存在相同文档的页签，聚焦并切换预览类型
    if (existingModel?.parent?.headElement) {
        existingModel.parent.parent.switchTab(existingModel.parent.headElement);
        existingModel.parent.parent.showHeading();
        existingModel.element.dispatchEvent(new CustomEvent(EXPORT_PREVIEW_SET_TYPE_EVENT, {
            detail: { previewType },
        }));
        return;
    }

    await app.openTab({
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
