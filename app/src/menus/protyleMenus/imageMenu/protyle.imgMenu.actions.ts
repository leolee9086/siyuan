/** 用途：更新时间字符串；使用范围：cut/delete 等结构修改后事务更新；解耦评估：第三方依赖由 imports.ts 转发。 */
import { dayjs } from "./imports";
/** 用途：重命名资源；使用范围：rename 菜单项点击动作；解耦评估：资源改名能力由编辑器层封装。 */
import { renameAsset } from "./imports";
/** 用途：菜单项构造器；使用范围：生成图片菜单动作项；解耦评估：UI 组件能力统一来源。 */
import { MenuItem } from "./imports";
/** 用途：国际化文案；使用范围：菜单项 label；解耦评估：文案来源统一。 */
import { siyuanI18n } from "./imports";
/** 用途：写入系统剪贴板；使用范围：复制 markdown/链接；解耦评估：平台差异由兼容层封装。 */
import { writeText } from "./imports";
/** 用途：提交事务；使用范围：cut/delete 后持久化更新；解耦评估：事务入口统一。 */
import { updateTransaction } from "./imports";
/** 用途：按 wbr 恢复光标；使用范围：cut/delete 后恢复编辑位置；解耦评估：选区逻辑由工具层封装。 */
import { focusByWbr } from "./imports";
/** 用途：按链接复制 PNG；使用范围：copyAsPNG 菜单项；解耦评估：格式转换逻辑集中在 util 层。 */
import { copyPNGByLink } from "./imports";
/** 用途：读取全局配置；使用范围：快捷键文案读取；解耦评估：配置访问经环境层封装，避免 window 直连。 */
import { getSiyuanConfig } from "./imports";

/**
 * 作用：将图片节点序列化为可复制 markdown。
 * 意图：统一 `%20` 空格兼容处理，避免 copy/cut 流程重复。
 * 调用时机：copy 与 cut 动作执行时。
 * 问题/改进：后续可按需求扩展更多 URL 规范化规则。
 */
const 生成复制文本 = (protyle: IProtyle, assetElement: HTMLElement) => {
    const markdown = protyle.lute.BlockDOM2StdMd(assetElement.outerHTML);
    return markdown.replace(/%20/g, " ");
};

/**
 * 作用：执行删除节点并提交事务。
 * 意图：收敛 cut/delete 的共同流程，保证行为一致。
 * 调用时机：cut/delete 动作点击时。
 * 问题/改进：目前通过 `<wbr>` 恢复光标，后续可评估更稳健锚点策略。
 */
const 执行删除并提交事务 = (
    protyle: IProtyle,
    assetElement: HTMLElement,
    nodeElement: Element,
    id: string,
    html: string,
    range: Range
) => {
    assetElement.outerHTML = "<wbr>";
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    updateTransaction(protyle, id, nodeElement.outerHTML, html);
    focusByWbr(protyle.wysiwyg.element, range);
};

/**
 * 作用：读取“复制为 PNG”快捷键文案。
 * 意图：避免业务层直接访问 window 配置。
 * 调用时机：创建 copyAsPNG 菜单项时。
 * 问题/改进：后续若快捷键来源调整，只需修改此处。
 */
const 读取复制为PNG快捷键 = () => {
    return getSiyuanConfig().keymap.editor.general.copyBlockRef.custom;
};

/**
 * 作用：执行复制图片 markdown。
 * 意图：把 copy 的处理逻辑命名化，避免菜单配置中出现匿名函数。
 * 调用时机：copy 菜单项点击时。
 * 问题/改进：后续可扩展“复制纯文本/HTML”模式。
 */
const 执行复制图片Markdown = (protyle: IProtyle, assetElement: HTMLElement) => {
    const content = 生成复制文本(protyle, assetElement);
    writeText(content);
};

/**
 * 作用：执行复制图片 URL。
 * 意图：集中处理 src 为空时的兜底行为。
 * 调用时机：copyImageURL 菜单项点击时。
 * 问题/改进：后续可增加复制 data-src 的可选模式。
 */
const 执行复制图片链接 = (imgElement: HTMLImageElement) => {
    const src = imgElement.getAttribute("src") || "";
    writeText(src);
};

/**
 * 作用：执行复制为 PNG。
 * 意图：将链接读取与复制动作合并为命名处理器，提升可读性。
 * 调用时机：copyAsPNG 菜单项点击时。
 * 问题/改进：后续可增加失败提示反馈。
 */
const 执行复制为PNG = (imgElement: HTMLImageElement) => {
    const src = imgElement.getAttribute("src") || "";
    copyPNGByLink(src);
};

/**
 * 作用：执行图片剪切。
 * 意图：先复制再删除，复用 delete 的事务与聚焦逻辑。
 * 调用时机：cut 菜单项点击时。
 * 问题/改进：后续可进一步抽象为“可选复制”的通用删除流程。
 */
const 执行剪切图片 = (
    protyle: IProtyle,
    assetElement: HTMLElement,
    nodeElement: Element,
    id: string,
    html: string,
    range: Range
) => {
    const content = 生成复制文本(protyle, assetElement);
    writeText(content);
    执行删除并提交事务(protyle, assetElement, nodeElement, id, html, range);
};

/**
 * 作用：生成复制菜单项。
 * 意图：对外提供 copy 动作构建入口。
 * 调用时机：imgMenu 基础菜单项构建阶段。
 * 问题/改进：后续可加入格式选择 submenu。
 */
/** @同步豁免: UI构建 */
export const genCopyItem = (protyle: IProtyle, assetElement: HTMLElement) => {
    return new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        accelerator: "⌘C",
        icon: "iconCopy",
        click: 执行复制图片Markdown.bind(null, protyle, assetElement)
    });
};

/**
 * 作用：生成复制图片 URL 菜单项。
 * 意图：提供只读场景常用的链接复制能力。
 * 调用时机：imgMenu 只读分支中。
 * 问题/改进：后续可增加“复制原始路径”选项。
 */
/** @同步豁免: UI构建 */
export const genCopyImageURLItem = (imgElement: HTMLImageElement) => {
    return new MenuItem({
        id: "copyImageURL",
        label: siyuanI18n.copy + " " + siyuanI18n.imageURL,
        icon: "iconLink",
        click: 执行复制图片链接.bind(null, imgElement)
    });
};

/**
 * 作用：生成复制为 PNG 菜单项。
 * 意图：提供图片格式复制能力。
 * 调用时机：imgMenu 基础菜单项构建阶段。
 * 问题/改进：后续可扩展更多导出格式。
 */
/** @同步豁免: UI构建 */
export const genCopyAsPNGItem = (imgElement: HTMLImageElement) => {
    return new MenuItem({
        id: "copyAsPNG",
        label: siyuanI18n.copyAsPNG,
        accelerator: 读取复制为PNG快捷键(),
        icon: "iconImage",
        click: 执行复制为PNG.bind(null, imgElement)
    });
};

/**
 * 作用：生成剪切菜单项。
 * 意图：复用复制与删除流程保持行为一致。
 * 调用时机：编辑态 imgMenu 中。
 * 问题/改进：后续可与 delete 合并成可配置动作构建器。
 */
/** @同步豁免: UI构建 */
export const genCutItem = (
    protyle: IProtyle,
    assetElement: HTMLElement,
    nodeElement: Element,
    id: string,
    html: string,
    range: Range
) => {
    return new MenuItem({
        id: "cut",
        icon: "iconCut",
        accelerator: "⌘X",
        label: siyuanI18n.cut,
        click: 执行剪切图片.bind(null, protyle, assetElement, nodeElement, id, html, range)
    });
};

/**
 * 作用：生成删除菜单项。
 * 意图：提供图片删除标准行为（删除 + 事务 + 恢复焦点）。
 * 调用时机：编辑态 imgMenu 中。
 * 问题/改进：后续可增加删除确认机制。
 */
/** @同步豁免: UI构建 */
export const genDeleteItem = (
    protyle: IProtyle,
    assetElement: HTMLElement,
    nodeElement: Element,
    id: string,
    html: string,
    range: Range
) => {
    return new MenuItem({
        id: "delete",
        icon: "iconTrashcan",
        accelerator: "⌫",
        label: siyuanI18n.delete,
        click: 执行删除并提交事务.bind(null, protyle, assetElement, nodeElement, id, html, range)
    });
};

/**
 * 作用：生成重命名菜单项。
 * 意图：提供资源改名入口。
 * 调用时机：data-src 为 assets 路径时。
 * 问题/改进：后续可加入路径冲突检查与提示。
 */
/** @同步豁免: UI构建 */
export const genRenameItem = (imagePath: string) => {
    return new MenuItem({
        id: "rename",
        label: siyuanI18n.rename,
        icon: "iconEdit",
        click: renameAsset.bind(null, imagePath)
    });
};
