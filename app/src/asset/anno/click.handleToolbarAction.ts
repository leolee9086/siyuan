import { fetchPost } from "../../ai/imports";
import { rectElement } from "../anno";
import { getConfig } from "../anno.config";
import { AnnoConstants } from "../anno.constants";
import { copyAnno } from "../anno.copy";
import { hideToolbar } from "../anno.hideToolbar";
import { downloadRectAsPng } from "../anno.getRectImgData";
import { setRelation } from "../anno.setRelation";
import type { IPdfInstance, ToolbarActionContext, ToolbarActionHandler, ToolbarActionRegistry } from "../anno.types";

// 类型重新导出，保持向后兼容
export type { ToolbarActionContext, ToolbarActionHandler } from "../anno.types";
/**
 * 创建工具栏操作上下文
 *
 * 提取工具栏操作所需的共享数据，避免重复获取
 *
 * @param pdf - PDF实例对象
 * @returns 工具栏操作上下文
 */
export const createToolbarActionContext = (pdf: IPdfInstance, element: HTMLElement): ToolbarActionContext => {
    const urlPath = pdf.appConfig.file.replace(location.origin, "").substr(1);
    const config = getConfig(pdf);
    const id = rectElement?.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID) || undefined;

    return {
        urlPath,
        config,
        id,
        pdf,
        element
    };
};


/**
 * 处理移除注释操作
 *
 * 从PDF中删除指定的注释，包括：
 * 1. 从配置中删除注释数据
 * 2. 从DOM中移除所有相关元素
 * 3. 保存更新后的配置到服务器
 * 4. 隐藏工具栏
 *
 * @param ctx - 工具栏操作上下文，包含共享数据
 * @param pdf - PDF实例对象
 */
const handleRemoveAction = (ctx: ToolbarActionContext) => {
    const { urlPath, config, id, pdf, element } = ctx;

    if (id) {
        delete config[id];
        const itemsToRemove = element.querySelectorAll(`[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`);
        for (const item of itemsToRemove) {
            item.remove();
        }

        fetchPost("/api/asset/setFileAnnotation", {
            path: urlPath + ".sya",
            data: JSON.stringify(config),
        });
    }
    hideToolbar(ctx.element);
};

/**
 * 处理复制注释操作
 *
 * 将当前选中的注释内容复制到剪贴板，包括：
 * 1. 隐藏工具栏
 * 2. 获取当前注释ID
 * 3. 调用复制功能，将注释链接复制到剪贴板
 *
 * @param ctx - 工具栏操作上下文，包含共享数据
 * @param pdf - PDF实例对象
 */
const handleCopyAction = (ctx: ToolbarActionContext) => {
    const { id, pdf, element } = ctx;

    hideToolbar(element);
    if (id) {
        copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${id}`,
            pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
    }
};

/**
 * 处理关联注释操作
 *
 * 触发注释关联功能，允许用户将当前注释与其他注释建立关联关系：
 * 1. 调用关联设置功能
 * 2. 隐藏工具栏
 *
 * @param ctx - 工具栏操作上下文，包含共享数据
 * @param pdf - PDF实例对象
 */
const handleRelateAction = (ctx: ToolbarActionContext) => {
    const { pdf } = ctx;
    console.log(pdf);
    setRelation(pdf);
    hideToolbar(ctx.element);
};

/**
 * 处理切换注释类型操作
 *
 * 在文本注释和边框注释之间切换显示模式：
 * 1. 切换注释类型（text ↔ border）
 * 2. 更新DOM样式以反映新的类型
 * 3. 保存更新后的配置到服务器
 * 4. 隐藏工具栏
 *
 * @param ctx - 工具栏操作上下文，包含共享数据
 * @param pdf - PDF实例对象
 */
/**
 * 更新注释DOM元素的样式
 * 
 * @param element - 容器元素
 * @param id - 注释ID
 * @param type - 注释类型
 */
const updateAnnotationStyle = (element: HTMLElement, id: string, type: string) => {
    const rectItems = element.querySelectorAll(`.${AnnoConstants.CSS.PDF_RECT}[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`);
    for (const rectItem of rectItems) {
        for (const item of Array.from(rectItem.children)) {
            if (item instanceof HTMLElement) {
                item.style.backgroundColor = type === "text" ? item.style.border.replace("2px solid ", "") : "";
            }
        }
    }
};

const handleToggleAction = (ctx: ToolbarActionContext) => {
    const { urlPath, config, id, element } = ctx;

    hideToolbar(ctx.element);
    if (!id) {
        return;
    }

    const annoItem = config[id];
    if (!annoItem) {
        return;
    }
    annoItem.type = annoItem.type === "border" ? "text" : "border";
    if (element) {
        updateAnnotationStyle(element, id, annoItem.type);
    }
    fetchPost("/api/asset/setFileAnnotation", {
        path: urlPath + ".sya",
        data: JSON.stringify(config),
    });
};


/**
 * 处理下载注释为PNG操作
 *
 * 将当前选中的矩形注释区域截图并下载为PNG文件：
 * 1. 调用截图下载功能
 * 2. 隐藏工具栏
 *
 * @param ctx - 工具栏操作上下文，包含共享数据
 */
const handleDownloadAction = async (ctx: ToolbarActionContext) => {
    const { pdf, element } = ctx;
    await downloadRectAsPng(pdf);
    hideToolbar(element);
};

/**
 * 工具栏操作处理器注册表
 *
 * 使用策略模式实现，将操作类型映射到对应的处理函数
 * 这种设计使得添加新操作类型变得简单，只需在注册表中添加新条目
 *
 * @example 添加新操作类型
 * ```typescript
 * // 添加新的操作类型
 * toolbarActionRegistry['newAction'] = handleNewAction;
 * ```
 */
export const toolbarActionRegistry: ToolbarActionRegistry = {
    [AnnoConstants.ACTION.REMOVE]: handleRemoveAction,
    [AnnoConstants.ACTION.COPY]: handleCopyAction,
    [AnnoConstants.ACTION.RELATE]: handleRelateAction,
    [AnnoConstants.ACTION.TOGGLE]: handleToggleAction,
    [AnnoConstants.ACTION.DOWNLOAD]: handleDownloadAction,
};

