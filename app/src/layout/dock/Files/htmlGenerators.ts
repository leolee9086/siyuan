/**
 * @fileoverview HTML生成器模块
 * 
 * 本模块包含文件树面板中用于生成HTML的工具函数。
 * 这些函数从Files.ts中提取出来，以提高代码的可维护性和可测试性。
 */

import { escapeAriaLabel, escapeHtml } from "../../../util/DOM/escape";
import { getDocDisplayName } from "../../../util/file/pathName";
import {unicode2Emoji} from "../../../emoji/emoji.render";
import { Constants } from "../../../constants";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, getSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getPublishAccessOptionByLevel } from "../../../protyle/util/publishAccess";

/**
 * 生成文档的aria-label属性值
 * 
 * @description
 * 作用：为文件树中的文档项生成无障碍标签，包含文档名称、大小、书签、别名、备注等信息
 * 
 * 意图：提供完整的文档元信息，用于屏幕阅读器和工具提示显示，
 * 帮助用户快速了解文档的详细信息而无需打开文档
 * 
 * 调用时机：在genFileHTML函数中调用，为每个文件项生成aria-label
 * 
 * @param item - 文件对象，包含文档的元信息
 * @param escapeMethod - 转义函数，用于处理特殊字符
 * @returns 格式化的aria-label字符串
 * 
 * @example
 * ```typescript
 * const label = genDocAriaLabel(fileItem, escapeAriaLabel);
 * // 返回: "文档名 <small class='ft__on-surface'>1.2KB</small>..."
 * ```
 */
/** @同步豁免: UI构建 - 此函数用于同步生成HTML字符串，在DOM渲染流程中被调用，必须同步返回以确保UI的即时更新 */
export const genDocAriaLabel = (
    item: IFile,
    escapeMethod: (text: string) => string
): string => {
    // 获取显示名称，空标题文档显示内核约定的空标题占位符
    const displayName = escapeMethod(getDocDisplayName(item.name, item.titleEmpty));
    
    // 构建基础信息：名称和大小
    let label = `${displayName} <small class='ft__on-surface'>${item.hSize ?? ""}</small>`;
    
    // 如果有书签，添加书签信息
    if (item.bookmark) {
        label += `<br>${siyuanI18n.bookmark} ${escapeMethod(item.bookmark)}`;
    }
    
    // 如果有命名，添加命名信息
    if (item.name1) {
        label += `<br>${siyuanI18n.name} ${escapeMethod(item.name1)}`;
    }
    
    // 如果有别名，添加别名信息
    if (item.alias) {
        label += `<br>${siyuanI18n.alias} ${escapeMethod(item.alias)}`;
    }
    
    // 如果有备注，添加备注信息
    if (item.memo) {
        label += `<br>${siyuanI18n.memo} ${escapeMethod(item.memo)}`;
    }
    
    // 如果有子文件，添加子文件数量信息
    if (item.subFileCount !== 0) {
        label += siyuanI18n.includeSubFile.replace("x", String(item.subFileCount ?? 0));
    }
    
    // 添加修改时间和创建时间
    label += `<br>${siyuanI18n.modifiedAt} ${item.hMtime ?? ""}`;
    label += `<br>${siyuanI18n.createdAt} ${item.hCtime ?? ""}`;
    
    return label;
};

/**
 * 生成单个文件项的HTML
 * 
 * @description
 * 作用：为文件树中的单个文档生成完整的HTML结构，包括图标、名称、操作按钮等
 * 
 * 意图：将文件数据转换为可渲染的HTML，支持拖拽、展开/折叠、右键菜单等交互功能
 * 
 * 调用时机：
 * - 在getLeaf方法中调用，用于加载文档的子文档列表
 * - 在文件树刷新时调用，用于重新渲染文件项
 * 
 * @param item - 文件对象，包含文档的元信息
 * @returns 文件项的HTML字符串
 * 
 * @example
 * ```typescript
 * const html = genFileHTML(fileItem);
 * // 返回: "<li data-node-id="..." draggable="true" ...>...</li>"
 * ```
 */
/** @同步豁免: UI构建 - 此函数用于同步生成文件项HTML，在文件树渲染流程中被调用，必须同步返回以确保列表的即时渲染 */
export const genFileHTML = (item: IFile): string => {
    const editingPublishAccess = document.querySelector(".sy__file")?.classList.contains("file-tree__publish-access--active") ?? false;
    // 生成引用计数HTML（如果有引用）
    let countHTML = "";
    // 当文档有被其他文档引用时，显示引用计数徽章，帮助用户了解文档的关联程度
    if (item.count && item.count > 0) {
        countHTML = `<span class="popover__block counter b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.ref}">${item.count}</span>`;
    }
    
    // 生成aria-label
    const ariaLabel = genDocAriaLabel(item, escapeAriaLabel);
    
    // 计算缩进（根据路径深度）
    const pathDepth = item.path?.split("/").length ?? 1;
    const paddingLeft = (pathDepth - 1) * 18;
    
    // 获取storage中的图标配置
    const storage = getSiyuanStorage();
    const localImages = storage?.[Constants.LOCAL_IMAGES];
    
    // 根据是否有子文件选择默认图标
    const defaultIcon = item.subFileCount === 0 
        ? localImages?.file ?? "" 
        : localImages?.folder ?? "";
    
    // 生成图标（优先使用自定义图标）
    const iconEmoji = unicode2Emoji(item.icon || defaultIcon);
    
    // 获取只读配置
    const config = getSiyuanConfig();
    const isReadonly = config?.readonly ?? false;
    const iconExpands = config.fileTree.docIconClickExpand;
    const iconAriaLabel = iconExpands ?
        (item.subFileCount > 0 ? siyuanI18n.docIconClickExpand : siyuanI18n.openDocument) :
        siyuanI18n.changeIcon;
    const actionClasses = `${iconExpands && item.subFileCount > 0 && !editingPublishAccess ? " file-tree__item--icon-expand" : ""}${
        iconExpands && item.subFileCount === 0 && !editingPublishAccess ? " file-tree__item--icon-open" : ""}${
        config.fileTree.parentDocClickExpand && item.subFileCount > 0 ? " file-tree__item--title-expand" : ""}`;
    
    // 生成折叠按钮的隐藏类（无子文件时隐藏）
    const toggleHiddenClass = item.subFileCount === 0 ? " fn__hidden" : "";
    
    // 生成新建按钮的隐藏类（只读模式时隐藏）
    const newButtonHiddenClass = isReadonly ? " fn__none" : "";
    
    // 发布权限编辑模式：隐藏图标，显示开关
    const iconHiddenClass = editingPublishAccess ? " fn__none" : "";
    const switchHiddenClass = editingPublishAccess ? "" : " fn__none";
    const switchHTML = `<span class="b3-list-item__switch b3-tooltips b3-tooltips__n${switchHiddenClass}" aria-label="${siyuanI18n.publishAccess}">${getPublishAccessOptionByLevel("public").iconHTML}</span>`;
    
    return `<li data-node-id="${item.id ?? ""}" data-name="${Lute.EscapeHTMLStr(item.name ?? "")}" draggable="true" data-count="${item.subFileCount ?? 0}"
data-type="navigation-file" 
style="--file-toggle-width:${paddingLeft + 18}px;--file-action-offset:${paddingLeft + 20}px"
class="b3-list-item b3-list-item--hide-action${actionClasses}" data-path="${item.path ?? ""}">
    <span style="padding-left: ${paddingLeft}px" class="b3-list-item__toggle b3-list-item__toggle--hl${toggleHiddenClass}">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    <span class="b3-list-item__icon ariaLabel popover__block${iconHiddenClass}" data-position="8east" data-id="${item.id ?? ""}" aria-label="${iconAriaLabel}">${iconEmoji}</span>
    ${switchHTML}
    <span class="b3-list-item__text ariaLabel" data-position="parentE"
aria-label="${ariaLabel}">${getDocDisplayName(item.name ?? "", item.titleEmpty, true)}</span>
    <span data-type="more-file" class="b3-list-item__action b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.more}">
        <svg><use xlink:href="#iconMore"></use></svg>
    </span>
    <span data-type="new" class="b3-list-item__action b3-tooltips b3-tooltips__nw${newButtonHiddenClass}" aria-label="${siyuanI18n.newSubDoc}">
        <svg><use xlink:href="#iconAdd"></use></svg>
    </span>
    ${countHTML}
</li>`;
};

/**
 * 生成笔记本的HTML
 * 
 * @description
 * 作用：为文件树中的笔记本生成完整的HTML结构，区分已打开和已关闭的笔记本
 * 
 * 意图：将笔记本数据转换为可渲染的HTML，已关闭的笔记本显示"打开"按钮，
 * 已打开的笔记本显示完整的操作按钮（更多、新建）
 * 
 * 调用时机：
 * - 在Files.init方法中调用，用于初始化文件树
 * - 在笔记本状态变化时调用，用于更新笔记本显示
 * 
 * @param item - 笔记本对象，包含笔记本的元信息
 * @returns 笔记本的HTML字符串
 * 
 * @example
 * ```typescript
 * const html = genNotebook(notebookItem);
 * // 已关闭: "<li data-url="..." class="b3-list-item b3-list-item--hide-action">...</li>"
 * // 已打开: "<ul class="b3-list b3-list--background" data-url="...">...</ul>"
 * ```
 */
/** @同步豁免: UI构建 - 此函数用于同步生成笔记本HTML，在文件树初始化和刷新时被调用，必须同步返回以确保笔记本列表的即时渲染 */
export const genNotebook = (item: INotebook): string => {
    const editingPublishAccess = document.querySelector(".sy__file")?.classList.contains("file-tree__publish-access--active") ?? false;
    // 获取storage中的图标配置
    const storage = getSiyuanStorage();
    const localImages = storage?.[Constants.LOCAL_IMAGES];
    const defaultNoteIcon = localImages?.note ?? "";
    
    // 发布权限编辑模式：隐藏图标，显示开关
    const iconHiddenClass = editingPublishAccess ? " fn__none" : "";
    const switchHiddenClass = editingPublishAccess ? "" : " fn__none";
    const switchHTML = `<span class="b3-list-item__switch b3-tooltips b3-tooltips__e${switchHiddenClass}" aria-label="${siyuanI18n.publishAccess}">${getPublishAccessOptionByLevel("public").iconHTML}</span>`;
    
    // 获取只读配置
    const config = getSiyuanConfig();
    const isReadonly = config?.readonly ?? false;
    const readonlyClass = isReadonly ? " fn__none" : "";
    const iconContent = item.encrypted && item.closed ? "🔒️" : unicode2Emoji(item.icon || defaultNoteIcon);
    const isBoxDoc = !item.closed && config.fileTree.boxDocEnabled;
    const hasChildren = isBoxDoc && item.subFileCount > 0;
    const iconUsesDocAction = isBoxDoc && config.fileTree.docIconClickExpand;
    const iconAriaLabel = iconUsesDocAction ?
        (hasChildren ? siyuanI18n.docIconClickExpand : siyuanI18n.openDocument) : siyuanI18n.changeIcon;
    const actionClasses = `${iconUsesDocAction && hasChildren && !editingPublishAccess ? " file-tree__item--icon-expand" : ""}${
        iconUsesDocAction && !hasChildren && !editingPublishAccess ? " file-tree__item--icon-open" : ""}${
        hasChildren && config.fileTree.parentDocClickExpand ? " file-tree__item--title-expand" : ""}`;
    const emojiHTML = `<span class="b3-list-item__icon ariaLabel${isBoxDoc ? " popover__block" : ""}${iconHiddenClass}" data-position="8east"${isBoxDoc ? ` data-id="${item.id}"` : ""} aria-label="${iconAriaLabel}">${iconContent}</span>`;
    
    // 已关闭的笔记本：显示简化的UI，只有打开按钮
    if (item.closed) {
        return `<li data-url="${item.id ?? ""}" class="b3-list-item b3-list-item--hide-action"${item.encrypted ? ' data-encrypted="true"' : ""}>
    <span class="b3-list-item__toggle fn__hidden">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    ${emojiHTML}
    ${switchHTML}
    <span class="b3-list-item__text" style="cursor: default;">${escapeHtml(item.name ?? "")}</span>
    <span data-type="open" data-url="${item.id ?? ""}" class="b3-list-item__action b3-tooltips b3-tooltips__w${readonlyClass}" aria-label="${siyuanI18n.openBy}">
        <svg><use xlink:href="#iconOpen"></use></svg>
    </span>
</li>`;
    }
    
    // 已打开的笔记本：显示完整的UI，包括更多和新建按钮
    // 获取文件树排序配置
    const fileTreeSort = config?.fileTree?.sort;
    const draggableAttr = fileTreeSort === 6 ? 'draggable="true"' : "";
    
    return `<ul class="b3-list b3-list--background" data-url="${item.id ?? ""}" data-sort="${item.sort ?? ""}" data-sortmode="${item.sortMode ?? ""}">
<li class="b3-list-item b3-list-item--hide-action${actionClasses}" ${draggableAttr}
style="--file-toggle-width:22px;--file-action-offset:22px"
data-type="navigation-root" data-path="/" data-count="${item.subFileCount || 0}" data-node-id="${config.fileTree.boxDocEnabled ? item.id : ""}">
    <span class="b3-list-item__toggle b3-list-item__toggle--hl${isBoxDoc && !hasChildren ? " fn__hidden" : ""}">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    ${emojiHTML}
    ${switchHTML}
    <span class="b3-list-item__text ariaLabel" data-position="parentE">${escapeHtml(item.name ?? "")}</span>
    <span data-type="more-root" class="b3-list-item__action b3-tooltips b3-tooltips__w${readonlyClass}" aria-label="${siyuanI18n.more}">
        <svg><use xlink:href="#iconMore"></use></svg>
    </span>
    <span data-type="new" class="b3-list-item__action b3-tooltips b3-tooltips__w${readonlyClass}" aria-label="${siyuanI18n.newSubDoc}">
        <svg><use xlink:href="#iconAdd"></use></svg>
    </span>
</li></ul>`;
};
