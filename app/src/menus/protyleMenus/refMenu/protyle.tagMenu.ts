/** 用途：生成更新时间字符串；使用范围：标签内容变更后写入 updated；解耦评估：通过 refMenu/imports.ts 转发，避免业务直接依赖第三方包。 */
import { dayjs } from "./imports";
/** 用途：聚焦指定 Range；使用范围：标签输入确认后恢复编辑光标；解耦评估：选区能力由工具层封装，业务侧只表达聚焦意图。 */
import { focusByRange } from "./imports";
/** 用途：读取菜单与编辑常量；使用范围：菜单 data-name、ZWSP 拼接；解耦评估：常量集中维护，避免业务散落魔法值。 */
import { Constants } from "./imports";
/** 用途：判断是否移动端；使用范围：菜单显示方式与搜索分支；解耦评估：平台判断集中在平台层，业务层只消费结果。 */
import { isMobile } from "./imports";
/** 用途：打开移动端搜索面板；使用范围：标签菜单“搜索”在移动端分支；解耦评估：搜索能力独立封装，业务侧只传查询参数。 */
import { popSearch } from "./imports";
/** 用途：触发插件扩展菜单事件；使用范围：标签菜单末尾挂载插件项；解耦评估：事件总线统一扩展入口。 */
import { emitOpenMenu } from "./imports";
/** 用途：隐藏干扰浮层；使用范围：标签菜单打开前隐藏 util/toolbar/hint；解耦评估：UI 协作逻辑集中在工具层。 */
import { hideElements } from "./imports";
/** 用途：查找标签所在块节点；使用范围：读取 node-id 与 outerHTML 事务更新；解耦评估：DOM 查找工具复用。 */
import { hasClosestBlock } from "./imports";
/** 用途：查找顶层 popover 祖先；使用范围：设置菜单 data-from 来源；解耦评估：DOM 工具复用，降低路径耦合。 */
import { hasTopClosestByClassName } from "./imports";
/** 用途：通过 wbr 恢复光标；使用范围：删除标签后恢复编辑位置；解耦评估：选区能力封装在工具层。 */
import { focusByWbr } from "./imports";
/** 用途：提交文档事务；使用范围：标签编辑、删除、转换后的更新提交；解耦评估：事务能力稳定，业务只提供前后 HTML。 */
import { updateTransaction } from "./imports";
/** 用途：打开桌面端全局搜索；使用范围：标签菜单“搜索”在桌面端分支；解耦评估：搜索入口独立封装。 */
import { openGlobalSearch } from "./imports";
/** 用途：重命名标签；使用范围：标签菜单“重命名”动作；解耦评估：重命名逻辑在平台函数层维护。 */
import { renameTag } from "./imports";
/** 用途：读取全局菜单实例；使用范围：append/popup/fullscreen/remove 操作；解耦评估：菜单单例由环境层维护。 */
import { getSiyuanGlobalMenusMenu } from "./imports";
/** 用途：读取国际化文案；使用范围：标签菜单文案和占位符；解耦评估：i18n 来源统一。 */
import { siyuanI18n } from "./imports";
/** 用途：菜单项构造器；使用范围：标签菜单各动作项创建；解耦评估：组件能力集中维护，业务层只拼装配置。 */
import { MenuItem } from "./imports";
/** 用途：生成标签联想列表；使用范围：标签输入时显示匹配标签；解耦评估：标签列表逻辑独立封装。 */
import { genTagList } from "./imports";
/** 用途：定位浮动元素；使用范围：标签联想列表定位；解耦评估：定位逻辑已封装为通用工具。 */
import { setPosition } from "./imports";
/** 用途：键盘上下键导航；使用范围：标签联想列表键盘导航；解耦评估：导航逻辑独立封装。 */
import { upDownHint } from "./imports";
/** 用途：查找 class 祖先；使用范围：标签联想列表点击事件；解耦评估：DOM 工具复用。 */
import { hasClosestByClassName } from "../../../protyle/util/hasClosest";

/**
 * 作用：执行复制或剪切命令。
 * 意图：复用 copy/cut 的公共选区逻辑。
 * 调用时机：标签菜单 copy/cut 点击。
 * 问题/改进：仍依赖 `execCommand`，后续可评估 Clipboard API 替代。
 */
const 执行复制或剪切 = (tagElement: HTMLElement, command: "copy" | "cut"): void => {
    const range = document.createRange();
    range.selectNode(tagElement);
    focusByRange(range);
    document.execCommand(command);
};

/**
 * 作用：执行标签搜索动作。
 * 意图：统一移动端与桌面端搜索分支。
 * 调用时机：标签菜单 search 点击。
 * 问题/改进：目前分支由 isMobile 判断，后续可考虑策略映射。
 */
const 执行标签搜索 = (protyle: IProtyle, tagElement: HTMLElement): void => {
    if (!isMobile) {
        openGlobalSearch(protyle.app, `#${tagElement.textContent}#`, false, { method: 0 });
        return;
    }

    popSearch(protyle.app, {
        hasReplace: false,
        method: 0,
        hPath: "",
        idPath: [],
        k: `#${tagElement.textContent}#`,
        r: "",
        page: 1,
    });
};

const 执行重命名标签 = (tagElement: HTMLElement) => {
    const tagName = tagElement.textContent.replace(Constants.ZWSP, "");
    getSiyuanGlobalMenusMenu().remove();
    renameTag(tagName);
};

/**
 * 作用：触发插件扩展菜单。
 * 意图：保持标签菜单可被插件扩展。
 * 调用时机：标签菜单基础项构建完成后。
 * 问题/改进：依赖运行时插件列表，后续可增加空插件时的监控日志。
 */
const 触发插件扩展菜单 = (protyle: IProtyle, tagElement: HTMLElement): void => {
    if (!protyle?.app?.plugins) {
        return;
    }
    emitOpenMenu({
        plugins: protyle.app.plugins,
        type: "open-menu-tag",
        detail: {
            protyle,
            element: tagElement,
        },
        separatorPosition: "top",
    });
};

/**
 * 作用：根据端类型展示菜单。
 * 意图：移动端全屏，桌面端锚点弹出，保持历史交互一致。
 * 调用时机：菜单项构建后。
 * 问题/改进：桌面端偏移值 26 为历史常量，后续可提取配置。
 */
const 展示标签菜单 = (protyle: IProtyle, tagElement: HTMLElement): void => {
    if (isMobile) {
        getSiyuanGlobalMenusMenu().fullscreen();
    }

    if (!isMobile) {
        const rect = tagElement.getBoundingClientRect();
        getSiyuanGlobalMenusMenu().popup({
            x: rect.left,
            y: rect.top + 26,
            h: 26
        });
    }

    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    getSiyuanGlobalMenusMenu().element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
};

/**
 * 作用：把标签转换为纯文本行内标记。
 * 意图：复用 turnIntoText 的点击逻辑，避免内联长回调。
 * 调用时机：标签菜单 turnIntoText 点击。
 * 问题/改进：依赖 toolbar.range，后续可评估更明确的范围参数传递。
 */
const 执行转换为文本 = (protyle: IProtyle, tagElement: HTMLElement): void => {
    const toolbar = protyle.toolbar;
    if (!toolbar) {
        return;
    }
    if (!tagElement.firstChild || !tagElement.lastChild) {
        return;
    }
    toolbar.range.setStart(tagElement.firstChild, 0);
    toolbar.range.setEnd(tagElement.lastChild, tagElement.lastChild.textContent?.length ?? 0);
    toolbar.setInlineMark(protyle, "tag", "range");
};

/**
 * 作用：追加标签菜单动作项。
 * 意图：将菜单项构建从主流程中拆出，降低主函数长度与复杂度。
 * 调用时机：tagMenu 在创建输入项后调用。
 * 问题/改进：目前动作顺序仍为硬编码，后续可抽象为配置驱动。
 */
const 追加标签菜单动作项 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    tagElement: HTMLElement
): void => {
    getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_1", type: "separator" }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "search",
        label: siyuanI18n.search,
        accelerator: siyuanI18n.click,
        icon: "iconSearch",
        click: 执行标签搜索.bind(null, protyle, tagElement)
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "rename",
        label: siyuanI18n.rename,
        icon: "iconEdit",
        click: 执行重命名标签.bind(null, tagElement)
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "turnIntoText",
        label: `${siyuanI18n.turnInto} <b>${siyuanI18n.text}</b>`,
        icon: "iconRefresh",
        click: 执行转换为文本.bind(null, protyle, tagElement)
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        click: 执行复制或剪切.bind(null, tagElement, "copy")
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "cut",
        label: siyuanI18n.cut,
        icon: "iconCut",
        click: 执行复制或剪切.bind(null, tagElement, "cut")
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "remove",
        icon: "iconTrashcan",
        label: siyuanI18n.remove,
        click: 删除标签并恢复光标.bind(null, protyle, id, nodeElement, tagElement)
    }).element);
};

/**
 * 作用：构建并弹出标签上下文菜单。
 * 意图：把标签编辑、搜索、转换、复制剪切删除动作集中在统一入口。
 * 调用时机：用户在标签节点触发上下文菜单时。
 * 问题/改进：仍有少量历史行为依赖 `toolbar.range`，后续可继续收敛。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const tagMenu = (protyle: IProtyle, tagElement: HTMLElement) => {
    getSiyuanGlobalMenusMenu().remove();
    const nodeElement = hasClosestBlock(tagElement);
    if (!nodeElement) {
        return;
    }
    const oldHTML = nodeElement.outerHTML;
    const id = nodeElement.getAttribute("data-node-id");
    let inputElement: HTMLInputElement;
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_INLINE_TAG);
    getSiyuanGlobalMenusMenu().removeCB = () => {
        tagElement.innerHTML = Constants.ZWSP + Lute.EscapeHTMLStr(inputElement.value || "");
        if (!inputElement.value) {
            tagElement.insertAdjacentHTML("afterend", "<wbr>");
            tagElement.remove();
            focusByWbr(nodeElement, protyle.toolbar.range);
        } else {
            protyle.toolbar.range.selectNodeContents(tagElement);
            protyle.toolbar.range.collapse(false);
            focusByRange(protyle.toolbar.range);
        }
        if (nodeElement.outerHTML !== oldHTML) {
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, nodeElement, oldHTML);
        }
    };

    hideElements(["util", "toolbar", "hint"], protyle);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "tag",
        iconHTML: "",
        type: "readonly",
        label: `<input ${Constants.ATTRIBUTE_MENU_KEYMAP}="true" class="b3-text-field fn__block" style="margin: 4px 0" placeholder="${siyuanI18n.tag}">
<div class="fn__none b3-list fn__flex-1 b3-list--background protyle-hint" style="position: fixed"></div>`,
        bind(element) {
            const listElement = element.querySelector(".b3-list") as HTMLElement;
            inputElement = element.querySelector("input");
            inputElement.value = tagElement.textContent.replace(Constants.ZWSP, "");
            inputElement.addEventListener("compositionend", () => {
                genTagList(listElement, inputElement.value.trim());
                setPosition(listElement, inputElementRect.right + 8, inputElementRect[isMobile ? "bottom" : "top"], inputElementRect.height);
            });
            inputElement.addEventListener("input", (event: KeyboardEvent) => {
                if (!event.isComposing) {
                    listElement.classList.remove("fn__none");
                    genTagList(listElement, inputElement.value.trim());
                    setPosition(listElement, inputElementRect.right + 8, inputElementRect[isMobile ? "bottom" : "top"], inputElementRect.height);
                }
            });
            inputElement.addEventListener("keydown", (event) => {
                if (event.isComposing) {
                    return;
                }
                if (!listElement.classList.contains("fn__none")) {
                    upDownHint(listElement, event);
                    if (event.key === "Enter" || event.key === "Escape") {
                        listElement.classList.add("fn__none");
                    }
                    if (event.key === "Enter") {
                        const currentElement = listElement.querySelector(".b3-list-item--focus") as HTMLElement;
                        inputElement.value = currentElement.dataset.type === "new" ? currentElement.querySelector("mark").textContent.trim() : currentElement.textContent.trim();
                    }
                    event.stopPropagation();
                    return;
                }
                if (event.key === "Escape") {
                    getSiyuanGlobalMenusMenu().removeCB = null;
                }
            });
            listElement.addEventListener("click", (event) => {
                const target = event.target as HTMLElement;
                const listItemElement = hasClosestByClassName(target, "b3-list-item");
                if (!listItemElement) {
                    return;
                }
                inputElement.value = listItemElement.dataset.type === "new" ? listItemElement.querySelector("mark").textContent.trim() : listItemElement.textContent.trim();
                listElement.classList.add("fn__none");
            });
        }
    }).element);

    追加标签菜单动作项(protyle, id, nodeElement, tagElement);

    触发插件扩展菜单(protyle, tagElement);
    展示标签菜单(protyle, tagElement);

    inputElement.select();
    const inputElementRect = inputElement.getBoundingClientRect();
};
