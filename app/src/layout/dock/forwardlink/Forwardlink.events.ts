/**
 * Forwardlink.events.ts - 正向链接组件事件绑定
 * 
 * 作用：从 Forwardlink.helpers.ts 拆分的事件绑定函数
 * 意图：保持单个文件行数在 300 行以内
 */

import type {ForwardlinkDomain} from "./Forwardlink.types";
import { 设置面板焦点, 切换列表项展开, 执行正向链接搜索 } from "./Forwardlink.helpers";

/**
 * 处理输入框 blur 事件
 * 根据输入值更新筛选图标状态
 */
function 处理输入框失焦(
    inputElement: HTMLInputElement,
    siyuanI18n: { filter: string }
): void {
    inputElement.classList.add("fn__none");
    const filterIconElement = inputElement.nextElementSibling;
    // 如果输入框有值，高亮筛选图标并显示筛选条件
    if (inputElement.value) {
        filterIconElement?.classList.add("block__icon--active");
        filterIconElement?.setAttribute("aria-label", siyuanI18n.filter + " " + inputElement.value);
        return;
    }
    // 输入框为空时，移除高亮状态
    filterIconElement?.classList.remove("block__icon--active");
    filterIconElement?.setAttribute("aria-label", siyuanI18n.filter);
}

/**
 * 绑定输入框事件（blur 和 keydown）
 * @param forwardlink - Forwardlink 实例
 * @param siyuanI18n - 国际化对象
 */
export function 绑定输入框事件(
    forwardlink: ForwardlinkDomain,
    siyuanI18n: { filter: string }
): void {
    for (const item of forwardlink.inputsElement) {
        item.addEventListener("blur", (event: FocusEvent) => {
            // 确保事件目标是 HTMLInputElement 类型
            if (!(event.target instanceof HTMLInputElement)) {
                return;
            }
            处理输入框失焦(event.target, siyuanI18n);
        });
        item.addEventListener("keydown", (event: KeyboardEvent) => {
            // 只在非中文输入法状态下、按下回车键时触发搜索
            // isComposing 为 true 表示正在使用输入法组合字符
            if (event.isComposing || event.key !== "Enter") {
                return;
            }
            执行正向链接搜索(forwardlink);
        });
    }
}

/**
 * 绑定 Tree 滚动事件，用于隐藏 gutters 和高亮
 * @param forwardlink - Forwardlink 实例
 */
export function 绑定Tree滚动事件(forwardlink: ForwardlinkDomain): void {
    forwardlink.tree.element.addEventListener("scroll", () => {
        const gutterElements = forwardlink.tree.element.querySelectorAll(".protyle-gutters");
        for (const item of gutterElements) {
            item.classList.add("fn__none");
            item.innerHTML = "";
        }
        const hlElements = forwardlink.tree.element.querySelectorAll(".protyle-wysiwyg--hl");
        for (const hlItem of hlElements) {
            hlItem.classList.remove("protyle-wysiwyg--hl");
        }
    });
}

/**
 * 绑定折叠按钮事件
 * @param forwardlink - Forwardlink 实例
 */
export function 绑定折叠按钮事件(forwardlink: ForwardlinkDomain): void {
    const collapseElement = forwardlink.element.querySelector('[data-type="collapse"]');
    if (!collapseElement) {
        return;
    }
    collapseElement.addEventListener("click", () => {
        const protyleElements = forwardlink.tree.element.querySelectorAll(".protyle");
        for (const item of protyleElements) {
            item.classList.add("fn__none");
        }
        const arrowElements = forwardlink.tree.element.querySelectorAll(".b3-list-item__arrow");
        for (const item of arrowElements) {
            item.classList.remove("b3-list-item__arrow--open");
        }
    });
}

/**
 * 绑定展开按钮事件
 * @param forwardlink - Forwardlink 实例
 */
export function 绑定展开按钮事件(forwardlink: ForwardlinkDomain): void {
    const expandElement = forwardlink.element.querySelector('[data-type="expand"]');
    if (!expandElement) {
        return;
    }
    expandElement.addEventListener("click", () => {
        const firstChild = forwardlink.tree.element.firstElementChild;
        if (!firstChild) {
            return;
        }
        for (const item of Array.from(firstChild.children)) {
            // 只展开尚未展开的列表项（没有 arrow--open 类的 LI 元素）
            // 使用 instanceof 检查确保 item 是 HTMLElement 类型
            if (!(item instanceof HTMLElement) || item.tagName !== "LI" || item.querySelector(".b3-list-item__arrow--open")) {
                continue;
            }
            切换列表项展开(forwardlink, item);
        }
    });
}

/**
 * 工具栏按钮点击处理函数映射
 * 使用 Object Literal 替代 switch 语句
 */
function 创建工具栏操作映射(
    forwardlink: ForwardlinkDomain,
    getDockByType: (type: string) => { toggleModel: (type: string, show: boolean, close: boolean) => void } | undefined,
    showSortMenu: (sort: string, element: HTMLElement, callback: () => void) => void,
    getSiyuanGlobalMenusMenu: () => { popup: (pos: { x: number; y: number }) => void }
): Record<string, (target: HTMLElement, event: MouseEvent) => void> {
    return {
        "refresh": () => {
            forwardlink.refresh();
        },
        "min": () => {
            getDockByType("forwardlink")?.toggleModel("forwardlink", false, true);
        },
        "search": (target) => {
            const previousSibling = target.previousElementSibling;
            if (!(previousSibling instanceof HTMLInputElement)) {
                return;
            }
            previousSibling.classList.remove("fn__none");
            previousSibling.select();
        },
        "sort": (target, event) => {
            const sort = target.getAttribute("data-sort") || "0";
            showSortMenu(sort, forwardlink.tree.element, () => 执行正向链接搜索(forwardlink));
            getSiyuanGlobalMenusMenu().popup({ x: event.clientX, y: event.clientY });
            event.stopPropagation();
        }
    };
}

/**
 * 处理主元素点击事件
 * 遍历事件目标链，查找并执行对应的工具栏操作
 */
function 处理主元素点击(
    event: MouseEvent,
    forwardlink: ForwardlinkDomain,
    操作映射: Record<string, (target: HTMLElement, event: MouseEvent) => void>
): void {
    设置面板焦点(forwardlink);

    let target = event.target;
    while (target && target !== forwardlink.element) {
        // 确保 target 是 HTMLElement 类型
        if (!(target instanceof HTMLElement)) {
            target = (target as Node).parentElement;
            continue;
        }
        // 检查点击的是否是顶层工具栏中的图标按钮
        // 条件：具有 block__icon 类，且其祖父元素是当前组件根元素
        if (target.classList.contains("block__icon") && target.parentElement?.parentElement === forwardlink.element) {
            const type = target.getAttribute("data-type");
            if (type && 操作映射[type]) {
                操作映射[type](target, event);
            }
        }
        target = target.parentElement;
    }
}

/**
 * 绑定主元素点击委托事件
 * @param forwardlink - Forwardlink 实例
 * @param getDockByType - 获取 Dock 的函数
 * @param showSortMenu - 显示排序菜单的函数
 * @param getSiyuanGlobalMenusMenu - 获取全局菜单的函数
 */
export function 绑定主元素点击事件(
    forwardlink: ForwardlinkDomain,
    getDockByType: (type: string) => { toggleModel: (type: string, show: boolean, close: boolean) => void } | undefined,
    showSortMenu: (sort: string, element: HTMLElement, callback: () => void) => void,
    getSiyuanGlobalMenusMenu: () => { popup: (pos: { x: number; y: number }) => void }
): void {
    const 操作映射 = 创建工具栏操作映射(forwardlink, getDockByType, showSortMenu, getSiyuanGlobalMenusMenu);
    forwardlink.element.addEventListener("click", (event) => {
        处理主元素点击(event, forwardlink, 操作映射);
    });
}
