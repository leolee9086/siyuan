import { fetchPost } from "../ai/imports";
import { rectElement } from "./anno";
import { getConfig } from "./anno.config";
import { AnnoConstants } from "./anno.constants";
import { copyAnno } from "./anno.copy";
import { hideToolbar } from "./anno.hideToolbar";
import { setRelation } from "./anno.setRelation";
import type { IPdfInstance } from "./anno.types";

/**
 * 工具栏操作处理器接口
 *
 * 定义了工具栏操作处理器的标准签名，所有处理器都应遵循此接口
 *
 * @param ctx - 工具栏操作上下文，包含共享数据和PDF实例
 */
export type ToolbarActionHandler = (ctx: ToolbarActionContext) => void;
/**
 * 工具栏操作处理器注册表
 *
 * 使用对象映射将操作类型字符串与对应的处理函数关联
 * 实现了策略模式，便于扩展新的操作类型
 *
 * @example
 * ```typescript
 * const registry: ToolbarActionRegistry = {
 *   'remove': handleRemoveAction,
 *   'copy': handleCopyAction,
 *   // 可以轻松添加新操作
 *   'newAction': handleNewAction,
 * };
 * ```
 */
type ToolbarActionRegistry = Record<string, ToolbarActionHandler>;

/**
 * 工具栏操作上下文
 *
 * 包含工具栏操作处理所需的共享数据，避免重复获取
 */
export interface ToolbarActionContext {
    /** PDF文件路径，不包含origin */
    urlPath: string;
    /** 注释配置对象 */
    config: Record<string, any>;
    /** 当前注释ID */
    id: string | undefined;
    /** PDF实例对象 */
    pdf: IPdfInstance;
}
/**
 * 创建工具栏操作上下文
 *
 * 提取工具栏操作所需的共享数据，避免重复获取
 *
 * @param pdf - PDF实例对象
 * @returns 工具栏操作上下文
 */
export const createToolbarActionContext = (pdf: IPdfInstance): ToolbarActionContext => {
    const urlPath = pdf.appConfig.file.replace(location.origin, "").substr(1);
    const config = getConfig(pdf);
    const id = rectElement?.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID) || undefined;

    return {
        urlPath,
        config,
        id,
        pdf,
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
    const { urlPath, config, id, pdf } = ctx;

    if (id) {
        delete config[id];
        const element = document.querySelector(`[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`)?.parentElement as HTMLElement;
        if (element) {
            element.querySelectorAll(`[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`).forEach(item => {
                item.remove();
            });
        }
        fetchPost("/api/asset/setFileAnnotation", {
            path: urlPath + ".sya",
            data: JSON.stringify(config),
        });
    }
    hideToolbar(document.querySelector('.toolbar') as HTMLElement);
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
    const { id, pdf } = ctx;

    hideToolbar(document.querySelector('.toolbar') as HTMLElement);
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
    setRelation(pdf);
    hideToolbar(document.querySelector('.toolbar') as HTMLElement);
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
const handleToggleAction = (ctx: ToolbarActionContext) => {
    const { urlPath, config, id } = ctx;

    if (id) {
        const annoItem = config[id];
        if (annoItem.type === "border") {
            annoItem.type = "text";
        } else {
            annoItem.type = "border";
        }
        const element = document.querySelector(`[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`)?.parentElement as HTMLElement;
        if (element) {
            element.querySelectorAll(`.${AnnoConstants.CSS.PDF_RECT}[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`).forEach(rectItem => {
                Array.from(rectItem.children).forEach((item) => {
                    if (item instanceof HTMLElement) {
                        if (annoItem.type === "text") {
                            item.style.backgroundColor = item.style.border.replace("2px solid ", "");
                        } else {
                            item.style.backgroundColor = "";
                        }
                    }
                });
            });
        }
        fetchPost("/api/asset/setFileAnnotation", {
            path: urlPath + ".sya",
            data: JSON.stringify(config),
        });
    }
    hideToolbar(document.querySelector('.toolbar') as HTMLElement);
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
};

/**
 * 处理工具栏操作
 *
 * 使用注册表模式处理工具栏操作，替代原有的switch语句：
 * 1. 根据操作类型从注册表中查找对应的处理函数
 * 2. 如果找到处理函数则执行，否则忽略
 *
 * 这种实现方式的优势：
 * - 更好的可扩展性：添加新操作无需修改此函数
 * - 更好的可维护性：每种操作的逻辑独立在各自的函数中
 * - 更好的可测试性：可以单独测试每个处理函数
 *
 * @param type - 操作类型字符串，如 'remove', 'copy', 'relate', 'toggle'
 * @param element - 工具栏容器元素
 * @param pdf - PDF实例对象
 */
export const handleToolbarAction = (type: string, pdf: IPdfInstance) => {
    const handler = toolbarActionRegistry[type];
    if (handler) {
        const context = createToolbarActionContext(pdf);
        handler(context);
    }
};
