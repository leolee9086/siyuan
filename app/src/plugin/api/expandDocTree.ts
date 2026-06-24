/**
 * 用途：网络请求工具，用于调用后端API
 * 使用范围：本文件中调用getBlockInfo接口
 * 解耦评估：通过imports.ts转发
 */
import { fetchSyncPost } from "./imports";
/**
 * 用途：获取指定类型的模型实例
 * 使用范围：本文件中获取文件树模型
 * 解耦评估：同目录直接导入
 */
import { getModelByDockType } from "./getModelByDockType";
/**
 * 用途：安全访问全局笔记本列表
 * 使用范围：本文件中判断ID是否为笔记本
 * 解耦评估：通过imports.ts转发
 */
import { getSiyuanNotebooks } from "./imports";

type FileTreeModel = {
    element: HTMLElement;
    setCurrent: (target: HTMLElement, isScroll?: boolean) => void;
    getLeaf: (liElement: Element, notebookId: string, focusUpdate?: boolean) => void;
    selectItem: (
        notebookId: string,
        filePath: string,
        data?: {
            files: IFile[],
            box: string,
            path: string
        },
        setStorage?: boolean,
        isSetCurrent?: boolean
    ) => Promise<HTMLElement | undefined> | HTMLElement | undefined;
};

/**
 * 检查给定ID是否为笔记本ID
 *
 * 作用：判断ID是否存在于笔记本列表中
 * 意图：区分笔记本和文档块，以便采用不同的定位策略
 * 调用时机：在展开文档树前需要判断目标类型时
 *
 * @param id - 要检查的ID
 * @returns 如果是笔记本ID返回true，否则返回false
 */
const isNotebookId = (id: string) => {
    const notebooks = getSiyuanNotebooks();
    return notebooks.some(item => item.id === id);
};

/**
 * 判断对象是否具备文件树操作能力
 *
 * 作用：同时接纳桌面端 Files 和移动端 MobileFiles
 * 意图：避免通过具体 class 做运行时判断导致移动端文件树被排除
 * 调用时机：插件 API 展开文档树前验证 dock 模型
 */
const isFileTreeModel = (value: unknown): value is FileTreeModel => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value as Partial<FileTreeModel>;
    return candidate.element instanceof HTMLElement &&
        typeof candidate.setCurrent === "function" &&
        typeof candidate.getLeaf === "function" &&
        typeof candidate.selectItem === "function";
};

/**
 * 获取笔记本节点信息
 *
 * 作用：在文件树中查找指定笔记本的DOM节点并封装为统一格式
 * 意图：为笔记本类型的展开操作提供目标元素和笔记本ID
 * 调用时机：当确认目标为笔记本时调用
 *
 * @param file - 文件树管理实例
 * @param notebookId - 笔记本ID
 * @returns 包含节点元素和笔记本ID的对象，未找到返回null
 */
const getNotebookElementInfo = (
    file: FileTreeModel,
    notebookId: string
) => {
    const listElement = file.element.querySelector(`.b3-list[data-url="${notebookId}"]`);
    if (!listElement) {
        return null;
    }
    const firstChild = listElement.firstElementChild;
    if (!(firstChild instanceof HTMLElement)) {
        return null;
    }
    return { element: firstChild, notebookId };
};

/**
 * 获取文档块节点的DOM元素
 *
 * 作用：通过API获取块信息后在文件树中定位文档节点
 * 意图：为文档块类型的展开操作提供目标元素
 * 调用时机：当确认目标为文档块时调用
 *
 * @param file - 文件树管理实例
 * @param blockId - 文档块ID
 * @param isSetCurrent - 是否设置为当前选中项
 * @returns 包含文档节点元素和笔记本ID的对象，失败返回null
 */
const getDocumentElement = async (
    file: FileTreeModel,
    blockId: string,
    isSetCurrent: boolean
) => {
    const response = await fetchSyncPost("/api/block/getBlockInfo", { id: blockId });
    // API调用失败时返回null
    if (response.code === -1) {
        return null;
    }
    const element = await file.selectItem(
        response.data.box,
        response.data.path,
        undefined,
        undefined,
        isSetCurrent
    );
    if (!element) {
        return null;
    }
    return { element, notebookId: response.data.box };
};

/**
 * 展开文档树节点
 *
 * 作用：展开指定的文档树节点（如果尚未展开）
 * 意图：确保目标节点的子节点可见
 * 调用时机：在定位到目标节点后需要展开其子节点时
 *
 * @param liElement - 目标节点元素
 * @param file - 文件树管理实例
 * @param notebookId - 笔记本ID
 */
const expandTreeNode = (liElement: HTMLElement, file: FileTreeModel, notebookId: string) => {
    const toggleElement = liElement.querySelector(".b3-list-item__arrow");
    if (!toggleElement) {
        return;
    }
    // 如果节点已经展开，无需重复操作
    if (toggleElement.classList.contains("b3-list-item__arrow--open")) {
        return;
    }
    file.getLeaf(liElement, notebookId);
};

/**
 * 获取目标节点信息（笔记本或文档）
 *
 * 作用：根据ID类型获取对应的节点元素和笔记本ID
 * 意图：统一处理笔记本和文档两种类型的节点获取逻辑
 * 调用时机：在展开文档树时需要定位目标节点
 *
 * @param file - 文件树管理实例
 * @param id - 目标ID（笔记本或文档块）
 * @param isSetCurrent - 是否设置为当前选中项
 * @returns 包含节点元素和笔记本ID的对象，失败返回null
 */
const getTargetNodeInfo = async (
    file: FileTreeModel,
    id: string,
    isSetCurrent: boolean
) => {
    // 如果是笔记本ID，直接查找笔记本节点
    if (isNotebookId(id)) {
        return getNotebookElementInfo(file, id);
    }
    // 如果是文档块ID，通过API获取文档节点
    return await getDocumentElement(file, id, isSetCurrent);
};

/**
 * 展开文档树到指定节点
 *
 * 作用：在文件树中定位并展开到指定的文档或笔记本节点
 * 意图：为插件提供程序化控制文档树展开状态的能力，支持快速导航到特定文档
 * 调用时机：
 *   - 插件需要在文件树中高亮显示特定文档时
 *   - 用户通过搜索或链接跳转到文档时需要在侧边栏展开对应节点
 *   - 需要程序化展开文档树结构时
 *
 * @param options.id - 要展开的文档块 ID 或笔记本 ID
 * @param options.isSetCurrent - 是否将目标节点设置为当前选中项，默认为 true
 */
export const expandDocTree = async (options: {
    id: string,
    isSetCurrent?: boolean
}) => {
    const file = getModelByDockType("file");
    if (!isFileTreeModel(file)) {
        return;
    }

    const isSetCurrent = options.isSetCurrent ?? true;

    const nodeInfo = await getTargetNodeInfo(file, options.id, isSetCurrent);
    if (!nodeInfo) {
        return;
    }

    // 根据参数决定是否将节点设置为当前选中项
    if (isSetCurrent) {
        file.setCurrent(nodeInfo.element);
    }

    expandTreeNode(nodeInfo.element, file, nodeInfo.notebookId);
};
