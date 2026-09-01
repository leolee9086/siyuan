/** 用途：发送注释持久化请求。使用范围：移除和切换标注后同步写入。解耦评估：通过 ./imports 转发网络边界。 */
import {fetchPost} from "./imports";
/** 用途：读取当前选择的矩形标注。使用范围：工具栏动作的目标上下文。解耦评估：selection state 是本目录唯一状态 owner。 */
import {rectElement} from "./state/selection";
/** 用途：读取当前 PDF 注释配置。使用范围：更新或删除持久化标注。解耦评估：config owner 保持缓存和网络加载语义。 */
import {getConfig} from "./config";
/** 用途：按字面属性值定位同一标注。使用范围：删除和样式更新，避免 selector 注入。解耦评估：guard 集中安全 DOM 查找。 */
import {getRectElementsByNodeId} from "./anno.guard";
/** 用途：提供标注 DOM 属性和动作常量。使用范围：工具栏 dispatcher。解耦评估：常量 owner 防止协议字面量分散。 */
import {AnnoConstants} from "./constants";
/** 用途：复制标注引用。使用范围：工具栏复制动作。解耦评估：copy owner 处理剪贴板和截图语义。 */
import {copyAnno} from "./anno.copy";
/** 用途：关闭 PDF 注释工具栏。使用范围：每个动作完成后的 UI 收尾。解耦评估：hide owner 集中 DOM 可见性语义。 */
import {hideToolbar} from "./anno.hideToolbar";
/** 用途：将选中标注下载为 PNG。使用范围：下载动作。解耦评估：截图 owner 封装 canvas 与文件输出。 */
import {downloadRectAsPng} from "./anno.getRectImgData";
/** 用途：导出当前 PDF 页为 PNG。使用范围：导出页动作。解耦评估：page export owner 封装图片生成。 */
import {exportPageAsPng} from "./anno.exportPage";
/** 用途：打开标注关联编辑界面。使用范围：关联动作。解耦评估：relation owner 维护关联列表和持久化。 */
import {setRelation} from "./anno.setRelation";
/** 用途：约束 PDF 实例参数。使用范围：工具栏上下文创建。解耦评估：纯类型不产生运行时依赖。 */
import type {IPdfInstance} from "./anno.types";
/** 用途：约束工具栏动作上下文。使用范围：内部 handler 参数与兼容性导出。解耦评估：纯类型不产生运行时依赖。 */
import type {ToolbarActionContext} from "./anno.types";

// 类型重新导出，保持向后兼容
export type { ToolbarActionContext, ToolbarActionHandler } from "./anno.types";
/** @同步豁免: UI构建 */
/**
 * 创建工具栏操作上下文
 *
 * 提取工具栏操作所需的共享数据，避免重复获取
 *
 * @param pdf - PDF实例对象
 * @returns 工具栏操作上下文
 */
export const createToolbarActionContext = (pdf: IPdfInstance, element: HTMLElement) => {
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
    const { urlPath, config, id, element } = ctx;

    if (id) {
        delete config[id];
        const itemsToRemove = getRectElementsByNodeId(element, id);
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
    if (rectElement) {
        setRelation(pdf, rectElement);
    }
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
    const rectItems = getRectElementsByNodeId(element, id);
    for (const rectItem of rectItems) {
        for (const item of Array.from(rectItem.children)) {
            // rectItem.children 返回 Element 类型，只有 HTMLElement 才有 style 属性
            // 此检查作为类型守卫，确保可以安全访问 item.style
            // 生效场景：实际上 PDF 注释的子元素都是 HTMLElement，此检查主要为了类型安全
            if (item instanceof HTMLElement) {
                item.style.backgroundColor = type === "text" ? item.style.border.replace("2px solid ", "") : "";
            }
        }
    }
};

/**
 * 处理切换注释类型操作
 *
 * @作用 在文本注释(text)和边框注释(border)之间切换显示模式:
 *       1. 隐藏工具栏
 *       2. 切换注释类型(text ↔ border)
 *       3. 更新DOM样式以反映新的类型
 *       4. 保存更新后的配置到服务器
 *
 * @意图 为用户提供在不同视觉样式间快速切换注释显示模式的能力。
 *       文本模式下,注释区域填充背景色;边框模式下,仅显示边框。
 *       这样用户可以根据阅读需求选择更合适的显示方式。
 *
 * @调用时机 通过 getToolbarAction 的 action resolver 调用,
 *          当用户点击PDF注释工具栏上的切换按钮时触发。
 *          该函数被注册为 AnnoConstants.ACTION.TOGGLE 对应的处理器。
 *
 * @问题改进 无已知问题。可能的改进:
 *          - 可以考虑支持更多注释类型(如高亮、下划线等)
 *          - 切换时可以添加过渡动画以提升用户体验
 *
 * @param ctx - 工具栏操作上下文,包含共享数据
 */
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
 * 处理导出本页为图片操作
 *
 * 将当前PDF页面截图并下载为PNG文件：
 * 1. 调用导出页面功能
 * 2. 隐藏工具栏
 *
 * @param ctx - 工具栏操作上下文，包含共享数据
 */
const handleExportPageAction = async (ctx: ToolbarActionContext) => {
    const { pdf, element } = ctx;
    await exportPageAsPng(pdf);
    hideToolbar(element);
};

/** @同步豁免: UI构建 */
/**
 * 从稳定的工具栏 action 字符串解析无状态处理器。
 * 解析器为每次分发构造冻结映射，不保存可变 registry，因此不会在测试或 HMR 间残留状态。
 */
export const getToolbarAction = (type: string) => {
    // @内联对象: 映射必须跟随动作实现定义，短生命周期冻结对象避免模块级可变状态。
    const actions = Object.freeze({
        [AnnoConstants.ACTION.REMOVE]: handleRemoveAction,
        [AnnoConstants.ACTION.COPY]: handleCopyAction,
        [AnnoConstants.ACTION.RELATE]: handleRelateAction,
        [AnnoConstants.ACTION.TOGGLE]: handleToggleAction,
        [AnnoConstants.ACTION.DOWNLOAD]: handleDownloadAction,
        [AnnoConstants.ACTION.EXPORT_PAGE]: handleExportPageAction,
    });
    return Reflect.get(actions, type);
};

