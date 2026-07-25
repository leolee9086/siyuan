/**
 * @fileoverview 文件树导航模块
 *
 * 本模块包含文件树面板中用于导航和选择的辅助函数。
 * 这些函数从Files.ts中提取出来，以提高代码的可维护性和可测试性。
 */

import { pathPosix } from "../../../util/file/pathName";
import { Constants } from "../../../constants";
import { fetchSyncPost } from "../../../util/network/fetch";
import { genFileHTML } from "./htmlGenerators";
import { unicode2Emoji } from "../../../emoji";
import { getSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type {SelectItemFn} from "./eventHandlers.types";

// ============================================================================
// updateItemArrow 辅助函数
// ============================================================================

/**
 * 处理根目录的展开刷新
 *
 * @description
 * 作用：当路径向上查找到根目录时，检查根目录是否已展开，如果是则刷新其内容
 *
 * @param firstChild - 根目录的第一个子元素
 * @param notebookId - 笔记本ID
 * @param getLeaf - 获取子文档列表的函数
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const handleRootDirectoryRefresh = (
    firstChild: Element | null,
    notebookId: string,
    getLeaf: (liElement: Element, notebookId: string, focusUpdate?: boolean) => void
): void => {
    // 根目录已展开时，刷新其内容以显示新创建的子文件
    const isRootExpanded = firstChild?.querySelector(".b3-list-item__arrow--open");
    // 只有当根目录存在且已展开时才刷新，避免对未展开的目录进行不必要的操作
    if (!isRootExpanded || !firstChild) {
        return;
    }
    getLeaf(firstChild, notebookId, true);
};

/**
 * 处理找到的元素的箭头状态更新
 *
 * @description
 * 作用：当找到目标元素后，检查其箭头是否隐藏，如果隐藏则显示，否则刷新子文档
 *
 * @param liElement - 找到的列表元素
 * @param notebookId - 笔记本ID
 * @param getLeaf - 获取子文档列表的函数
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const handleFoundElementArrow = (
    liElement: Element,
    notebookId: string,
    getLeaf: (liElement: Element, notebookId: string, focusUpdate?: boolean) => void
): void => {
    const hiddenElement = liElement.querySelector(".fn__hidden");
    // 原先无子文档：显示展开箭头
    if (hiddenElement) {
        hiddenElement.classList.remove("fn__hidden");
        return;
    }
    // 父文档已展开：刷新子列表（避免对未展开的目录进行不必要的刷新）
    if (liElement.querySelector(".b3-list-item__arrow--open")) {
        getLeaf(liElement, notebookId, true);
    }
};

// ============================================================================
// updateItemArrow
// ============================================================================

/**
 * 更新文件树项目的展开箭头状态
 *
 * @description
 * 作用：当文件路径对应的父级目录需要显示展开箭头时，更新其状态
 *
 * 意图：确保文件树的展开状态与实际文件结构一致，
 * 当子文件被创建时，父目录应该显示可展开的箭头
 *
 * 调用时机：在文件创建后，需要更新父目录的展开状态时调用
 *
 * @param element - 文件树的根元素
 * @param notebookId - 笔记本ID
 * @param filePath - 文件路径
 * @param getLeaf - 获取子文档列表的函数
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素以保持UI一致性 */
export const updateItemArrowFromModule = (
    element: HTMLElement,
    notebookId: string,
    filePath: string,
    getLeaf: (liElement: Element, notebookId: string, focusUpdate?: boolean) => void
): void => {
    const treeElement = element.querySelector(`[data-url="${notebookId}"]`);
    // 找不到笔记本元素时直接返回
    if (!treeElement) {
        return;
    }

    let currentPath = filePath;
    let liElement: Element | null = null;

    // 向上查找已存在的父级元素
    while (!liElement) {
        liElement = treeElement.querySelector(`[data-path="${currentPath}"]`);
        // 找到元素后处理箭头状态
        if (liElement) {
            handleFoundElementArrow(liElement, notebookId, getLeaf);
            break;
        }

        // 找不到当前路径的元素时，向上查找父目录
        const dirname = pathPosix().dirname(currentPath);
        // 已到达根目录
        if (dirname === "/") {
            handleRootDirectoryRefresh(treeElement.firstElementChild, notebookId, getLeaf);
            break;
        }
        currentPath = dirname + ".sy";
    }
};

// ============================================================================
// onLsSelect 辅助函数
// ============================================================================

/**
 * 获取本地图片图标配置
 *
 * @description
 * 作用：从存储中获取文件和文件夹的图标配置
 *
 * @returns 包含文件和文件夹图标的对象
 */
/** @同步豁免: UI构建 - 纯数据获取 */
const getLocalImageIcons = (): { fileIcon: string; folderIcon: string } => {
    const storage = getSiyuanStorage();
    const localImages = storage[Constants.LOCAL_IMAGES];
    return {
        fileIcon: unicode2Emoji(localImages?.file ?? ""),
        folderIcon: unicode2Emoji(localImages?.folder ?? ""),
    };
};

/**
 * 更新列表元素的展开状态
 *
 * @description
 * 作用：更新箭头、图标等展开状态相关的UI元素
 *
 * @param liElement - 列表元素
 * @param icons - 图标配置
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const updateExpandState = (
    liElement: Element,
    icons: { fileIcon: string; folderIcon: string }
): void => {
    // 更新展开箭头状态
    const arrowElement = liElement.querySelector(".b3-list-item__arrow");
    arrowElement?.classList.add("b3-list-item__arrow--open");
    arrowElement?.parentElement?.classList.remove("fn__hidden");

    // 更新图标（从文件图标变为文件夹图标）
    const emojiElement = liElement.querySelector(".b3-list-item__icon");
    // 当前显示的是文件图标时，更新为文件夹图标
    if (emojiElement?.textContent === icons.fileIcon) {
        emojiElement.textContent = icons.folderIcon;
    }
};

/**
 * 处理单个文件项的选择
 *
 * @description
 * 作用：根据文件路径匹配情况，递归选择目标文件
 *
 * @param item - 当前文件项
 * @param filePath - 目标文件路径
 * @param data - 文件列表数据
 * @param setStorage - 是否保存展开状态
 * @param isSetCurrent - 是否设置为当前选中项
 * @param selectItem - 选择文件项的函数
 * @returns 选中的文件元素或 undefined
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const processFileItem = async (
    item: IFile,
    filePath: string,
    data: { box: string },
    setStorage: boolean,
    isSetCurrent: boolean,
    selectItem: SelectItemFn
): Promise<HTMLElement | null | undefined> => {
    // 精确匹配目标文件
    if (filePath === item.path) {
        return selectItem(data.box, filePath, undefined, setStorage, isSetCurrent);
    }

    // 目标文件在当前目录的子目录中
    const itemPathWithoutExt = item.path.replace(".sy", "");
    if (!filePath.startsWith(itemPathWithoutExt)) {
        return undefined;
    }

    // 递归获取子目录内容并选中
    const response = await fetchSyncPost("/api/filetree/listDocsByPath", {
        notebook: data.box,
        path: item.path,
        app: Constants.SIYUAN_APPID,
    });
    return selectItem(response.data.box, filePath, response.data, setStorage, isSetCurrent);
};

// ============================================================================
// onLsSelect 辅助函数（续）
// ============================================================================

/**
 * 生成文件列表的HTML字符串
 *
 * @param files - 文件列表
 * @returns HTML字符串
 */
/** @同步豁免: UI构建 - 纯计算函数 */
const generateFilesHTML = (files: IFile[]): string => {
    let html = "";
    for (const item of files) {
        html += genFileHTML(item);
    }
    return html;
};

/**
 * 准备列表元素的展开状态
 *
 * @description
 * 作用：移除旧的子列表、更新展开状态、插入新的子列表
 *
 * @param liElement - 列表元素
 * @param fileHTML - 文件列表HTML
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const prepareListExpansion = (liElement: Element, fileHTML: string): void => {
    // 检查下一个兄弟元素是否为已展开的子列表（UL标签）
    const nextSibling = liElement.nextElementSibling;
    // 文件已展开时，先移除旧的子列表（避免重复渲染）
    if (nextSibling?.tagName === "UL") {
        nextSibling.remove();
    }

    // 更新展开状态（箭头和图标）
    const icons = getLocalImageIcons();
    updateExpandState(liElement, icons);

    // 插入子文件列表
    liElement.insertAdjacentHTML("afterend", `<ul>${fileHTML}</ul>`);
};

/**
 * 遍历文件列表并选中目标文件
 *
 * @param files - 文件列表
 * @param filePath - 目标文件路径
 * @param data - 文件列表数据
 * @param setStorage - 是否保存展开状态
 * @param isSetCurrent - 是否设置为当前选中项
 * @param selectItem - 选择文件项的函数
 * @returns 选中的文件元素
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const findAndSelectTarget = async (
    files: IFile[],
    filePath: string,
    data: { box: string },
    setStorage: boolean,
    isSetCurrent: boolean,
    selectItem: SelectItemFn
): Promise<HTMLElement | undefined> => {
    let result: HTMLElement | undefined;
    for (const item of files) {
        const found = await processFileItem(item, filePath, data, setStorage, isSetCurrent, selectItem);
        // 找到目标文件时记录结果
        if (found) {
            result = found;
        }
    }
    return result;
};

// ============================================================================
// onLsSelect
// ============================================================================

/**
 * 处理文件列表选择的回调
 *
 * @description
 * 作用：当获取到文件列表后，展开目录并选中目标文件
 *
 * 意图：实现文件树的递归展开和选中功能，
 * 确保用户可以定位到深层嵌套的文件
 *
 * 调用时机：在selectItem方法中，当需要展开目录并选中文件时调用
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素以保持UI一致性 */
export const onLsSelect = async (
    element: HTMLElement,
    data: { files: IFile[]; box: string; path: string },
    filePath: string,
    setStorage: boolean,
    isSetCurrent: boolean,
    selectItem: SelectItemFn,
    setCurrent: (target: HTMLElement, isScroll?: boolean) => void
): Promise<HTMLElement | undefined> => {
    const fileHTML = generateFilesHTML(data.files);
    // 没有文件时直接返回
    if (fileHTML === "") {
        return undefined;
    }

    const liElement = element.querySelector(
        `ul[data-url="${data.box}"] li[data-path="${data.path}"]`
    );
    // 找不到目标元素时直接返回
    if (!liElement) {
        return undefined;
    }

    prepareListExpansion(liElement, fileHTML);
    const newLiElement = await findAndSelectTarget(
        data.files, filePath, data, setStorage, isSetCurrent, selectItem
    );

    // 设置当前选中项
    if (isSetCurrent && newLiElement) {
        setCurrent(newLiElement);
    }

    return newLiElement;
};
