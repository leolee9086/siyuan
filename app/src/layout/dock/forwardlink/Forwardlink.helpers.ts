/**
 * Forwardlink.helpers.ts - 正向链接组件辅助函数
 * 
 * 作用：从 Forwardlink 类提取的模块级辅助函数，便于测试和复用
 * 意图：将 Forwardlink.ts 的行数控制在 300 行以内
 */

import { Protyle } from "../../../protyle";
import { getIconByType } from "../../../editor/getIcon";
import { setPanelFocus } from "../../utils/setPanelFocus";
import { searchForwardLinks, fetchBlocks } from "./Forwardlink.data";
import { openFileById } from "../../../editor/utils.openFileById";
import { Constants } from "../../../constants";
import { Tree } from "../../../util/Tree";
import type { Forwardlink } from "./Forwardlink";
import type { App } from "../../../index";

/**
 * 设置面板焦点
 * @param forwardlink - Forwardlink 实例
 */
export function 设置面板焦点(forwardlink: Forwardlink): void {
    // local 类型的面板嵌入在标签页的内层容器中，DOM 层级为: element -> panelElement -> Tab
    // 需要向上查找两级获取真正的面板容器；而 pin 类型直接挂载在 Dock 根元素上，element 本身即为容器
    if (forwardlink.type === "local") {
        setPanelFocus(forwardlink.element.parentElement.parentElement);
        return;
    }
    setPanelFocus(forwardlink.element);
}

/**
 * 折叠列表项，清理其关联的编辑器实例
 * @param forwardlink - Forwardlink 实例
 * @param liElement - 要折叠的列表项元素
 */
export function 折叠列表项(forwardlink: Forwardlink, liElement: HTMLElement): void {
    const nextSibling = liElement.nextElementSibling as HTMLElement;
    if (nextSibling && nextSibling.getAttribute("data-type") === "wrapper") {
        const editorElement = nextSibling.querySelector(".protyle") as HTMLElement;
        if (editorElement) {
            const index = forwardlink.editors.findIndex(e => e.protyle.element === editorElement);
            if (index > -1) {
                forwardlink.editors[index]?.destroy();
                forwardlink.editors.splice(index, 1);
            }
        }
        nextSibling.remove();
    } else if (nextSibling) {
        // Fallback for old invalid DOM if present
        if (nextSibling.tagName === "UL") {
            nextSibling.remove();
        } else if (nextSibling.tagName === "DIV") {
            const index = forwardlink.editors.findIndex(e => e.protyle?.element === nextSibling);
            if (index > -1) {
                forwardlink.editors[index]?.destroy();
                forwardlink.editors.splice(index, 1);
            }
            nextSibling.remove();
        }
    }
}

/**
 * 获取并渲染文档下的块列表
 * @param forwardlink - Forwardlink 实例
 * @param liElement - 要展开的列表项元素
 * @param docId - 文档 ID
 */
export function 获取并渲染块列表(forwardlink: Forwardlink, liElement: HTMLElement, docId: string): void {
    fetchBlocks(forwardlink.rootId, docId, (blocks) => {
        if (blocks.length === 0) {
            return;
        }

        const wrapper = document.createElement("li");
        wrapper.setAttribute("data-type", "wrapper");
        wrapper.style.display = "block";

        const ul = document.createElement("ul");
        ul.className = "b3-list b3-list--background";

        let html = "";
        blocks.forEach((block: any) => {
            const icon = getIconByType(block.type, block.subType);
            // CustomLists 使用 mapBlockToTreeData 处理
            html += `<li data-node-id="${block.id}" data-type="${block.type}" data-subtype="${block.subType || ""}" class="b3-list-item b3-list-item--hide-action">
                <span class="b3-list-item__toggle"><svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg></span>
                <svg class="b3-list-item__graphic"><use xlink:href="#${icon}"></use></svg>
                <span class="b3-list-item__text">${block.content || "无内容"}</span>
            </li>`;
        });
        ul.innerHTML = html;
        wrapper.appendChild(ul);
        liElement.after(wrapper);
    });
}

/**
 * 渲染块的 Protyle 编辑器
 * @param forwardlink - Forwardlink 实例
 * @param liElement - 要展开的列表项元素
 * @param blockId - 块 ID
 */
export function 渲染块编辑器(forwardlink: Forwardlink, liElement: HTMLElement, blockId: string): void {
    const wrapper = document.createElement("li");
    wrapper.setAttribute("data-type", "wrapper");
    wrapper.style.display = "block";

    const editorElement = document.createElement("div");
    editorElement.style.minHeight = "auto";
    editorElement.className = "protyle"; // Marker class for collapse search

    wrapper.appendChild(editorElement);
    liElement.after(wrapper);

    try {
        const editor = new Protyle(forwardlink.app, editorElement, {
            blockId: blockId,
            click: {
                preventInsetEmptyBlock: true
            },
            render: {
                background: false,
                gutter: true,
                scroll: false,
                breadcrumb: false,
            }
        });
        forwardlink.editors.push(editor);
    } catch (e) {
        console.error(e);
    }
}

/**
 * 展开/折叠列表项
 * @param forwardlink - Forwardlink 实例
 * @param liElement - 目标列表项元素
 */
export function 切换列表项展开(forwardlink: Forwardlink, liElement: HTMLElement): void {
    const svgElement = liElement.firstElementChild?.firstElementChild;
    if (!svgElement) {
        return;
    }

    const type = liElement.getAttribute("data-type");
    const id = liElement.getAttribute("data-node-id");
    if (!id) {
        return;
    }

    if (svgElement.classList.contains("b3-list-item__arrow--open")) {
        svgElement.classList.remove("b3-list-item__arrow--open");
        折叠列表项(forwardlink, liElement);
    } else {
        svgElement.classList.add("b3-list-item__arrow--open");
        if (type === "NodeDocument") {
            获取并渲染块列表(forwardlink, liElement, id);
        } else {
            渲染块编辑器(forwardlink, liElement, id);
        }
    }
}

/**
 * 执行正向链接搜索
 * 
 * 作用：查询当前文档引用的所有目标块
 * 使用 SQL API 查询 refs 表，获取 root_id = 当前文档 的所有引用记录
 * 
 * @param forwardlink - Forwardlink 实例
 * @param init - 是否为初始化调用
 */
export function 执行正向链接搜索(forwardlink: Forwardlink, init = false): void {
    const element = forwardlink.element.querySelector('.block__icon[data-type="refresh"] svg');
    if (element?.classList.contains("fn__rotate")) {
        return;
    }
    element?.classList.add("fn__rotate");

    if (!forwardlink.rootId) {
        element?.classList.remove("fn__rotate");
        forwardlink.渲染数据({ forwardlinks: [], count: 0 });
        return;
    }

    const keyword = forwardlink.inputsElement[0]?.value || "";
    const sortAttr = forwardlink.tree.element.previousElementSibling?.querySelector('[data-type="sort"]')?.getAttribute("data-sort") || "0";

    searchForwardLinks(forwardlink.rootId, keyword, sortAttr, (data) => {
        if (!init) {
            forwardlink.保存状态();
        }
        forwardlink.渲染数据(data);
    });
}

/**
 * 绑定输入框事件（blur 和 keydown）
 * @param forwardlink - Forwardlink 实例
 * @param siyuanI18n - 国际化对象
 */
export function 绑定输入框事件(
    forwardlink: Forwardlink,
    siyuanI18n: { filter: string }
): void {
    forwardlink.inputsElement.forEach((item) => {
        item.addEventListener("blur", (event: FocusEvent) => {
            const inputElement = event.target as HTMLInputElement;
            inputElement.classList.add("fn__none");
            const filterIconElement = inputElement.nextElementSibling;
            if (inputElement.value) {
                filterIconElement?.classList.add("block__icon--active");
                filterIconElement?.setAttribute("aria-label", siyuanI18n.filter + " " + inputElement.value);
            } else {
                filterIconElement?.classList.remove("block__icon--active");
                filterIconElement?.setAttribute("aria-label", siyuanI18n.filter);
            }
        });
        item.addEventListener("keydown", (event: KeyboardEvent) => {
            if (!event.isComposing && event.key === "Enter") {
                执行正向链接搜索(forwardlink);
            }
        });
    });
}

/**
 * 绑定 Tree 滚动事件，用于隐藏 gutters 和高亮
 * @param forwardlink - Forwardlink 实例
 */
export function 绑定Tree滚动事件(forwardlink: Forwardlink): void {
    forwardlink.tree.element.addEventListener("scroll", () => {
        forwardlink.tree.element.querySelectorAll(".protyle-gutters").forEach(item => {
            item.classList.add("fn__none");
            item.innerHTML = "";
        });
        forwardlink.tree.element.querySelectorAll(".protyle-wysiwyg--hl").forEach((hlItem) => {
            hlItem.classList.remove("protyle-wysiwyg--hl");
        });
    });
}

/**
 * 绑定折叠按钮事件
 * @param forwardlink - Forwardlink 实例
 */
export function 绑定折叠按钮事件(forwardlink: Forwardlink): void {
    const collapseElement = forwardlink.element.querySelector('[data-type="collapse"]');
    if (collapseElement) {
        collapseElement.addEventListener("click", () => {
            forwardlink.tree.element.querySelectorAll(".protyle").forEach(item => {
                item.classList.add("fn__none");
            });
            forwardlink.tree.element.querySelectorAll(".b3-list-item__arrow").forEach(item => {
                item.classList.remove("b3-list-item__arrow--open");
            });
        });
    }
}

/**
 * 绑定展开按钮事件
 * @param forwardlink - Forwardlink 实例
 */
export function 绑定展开按钮事件(forwardlink: Forwardlink): void {
    const expandElement = forwardlink.element.querySelector('[data-type="expand"]');
    if (expandElement) {
        expandElement.addEventListener("click", () => {
            const firstChild = forwardlink.tree.element.firstElementChild;
            if (firstChild) {
                for (const item of Array.from(firstChild.children)) {
                    // 只展开尚未展开的列表项（没有 arrow--open 类的 LI 元素）
                    // 使用 instanceof 检查确保 item 是 HTMLElement 类型
                    if (item instanceof HTMLElement && item.tagName === "LI" && !item.querySelector(".b3-list-item__arrow--open")) {
                        切换列表项展开(forwardlink, item);
                    }
                }
            }
        });
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
    forwardlink: Forwardlink,
    getDockByType: (type: string) => { toggleModel: (type: string, show: boolean, close: boolean) => void } | undefined,
    showSortMenu: (sort: string, element: HTMLElement, callback: () => void) => void,
    getSiyuanGlobalMenusMenu: () => { popup: (pos: { x: number; y: number }) => void }
): void {
    forwardlink.element.addEventListener("click", (event) => {
        设置面板焦点(forwardlink);
        let target = event.target as HTMLElement;
        while (target && !target.isEqualNode(forwardlink.element)) {
            // 检查点击的是否是顶层工具栏中的图标按钮
            // 条件：具有 block__icon 类，且其祖父元素是当前组件根元素
            if (target.classList.contains("block__icon") && target.parentElement?.parentElement === forwardlink.element) {
                const type = target.getAttribute("data-type");
                switch (type) {
                    case "refresh":
                        forwardlink.refresh();
                        break;
                    case "min":
                        getDockByType("forwardlink")?.toggleModel("forwardlink", false, true);
                        break;
                    case "search":
                        target.previousElementSibling?.classList.remove("fn__none");
                        (target.previousElementSibling as HTMLInputElement)?.select();
                        break;
                    case "sort":
                        {
                            const sort = target.getAttribute("data-sort") || "0";
                            showSortMenu(sort, forwardlink.tree.element, () => 执行正向链接搜索(forwardlink));
                            getSiyuanGlobalMenusMenu().popup({ x: event.clientX, y: event.clientY });
                        }
                        event.stopPropagation();
                        break;
                }
            }
            target = target.parentElement as HTMLElement;
        }
    });
}

/**
 * 初始化 Tree 组件
 * 
 * 作用：创建并配置 Tree 组件实例，用于展示正向链接列表
 * 意图：将 Tree 组件的初始化逻辑从构造函数中分离，提高可读性和可测试性
 * 
 * @param forwardlink - Forwardlink 实例
 * @param options - 包含 app 实例的选项对象
 * @param openFileById - 打开文件的函数
 * @param Constants - 常量对象，包含 CB_GET_CONTEXT 等
 * @param Tree - Tree 组件类
 */
export function 初始化Tree组件(
    forwardlink: Forwardlink,
    options: { app: App }
): void {
    const forwardlinkListElement = forwardlink.element.querySelector(".forwardlinkList");
    if (!(forwardlinkListElement instanceof HTMLElement)) {
        throw new Error("Forwardlink: .forwardlinkList 元素不存在");
    }
    forwardlink.tree = new Tree({
        element: forwardlinkListElement,
        data: [],
        click: (element) => {
            切换列表项展开(forwardlink, element);
            设置面板焦点(forwardlink);
        },
        ctrlClick: (element) => {
            const id = element.getAttribute("data-node-id");
            if (!id) {
                return;
            }
            openFileById({
                app: options.app,
                id,
                action: [Constants.CB_GET_CONTEXT as TProtyleAction]
            });
        },
        altClick(element) {
            const id = element.getAttribute("data-node-id");
            if (!id) {
                return;
            }
            openFileById({
                app: options.app,
                id,
                position: "right",
                action: [Constants.CB_GET_FOCUS as TProtyleAction, Constants.CB_GET_CONTEXT as TProtyleAction]
            });
        },
        shiftClick(element) {
            const id = element.getAttribute("data-node-id");
            if (!id) {
                return;
            }
            openFileById({
                app: options.app,
                id,
                position: "bottom",
                action: [Constants.CB_GET_FOCUS as TProtyleAction, Constants.CB_GET_CONTEXT as TProtyleAction]
            });
        },
        toggleClick: (liElement) => {
            切换列表项展开(forwardlink, liElement);
            设置面板焦点(forwardlink);
        }
    });
}

/**
 * 处理消息回调
 * 
 * 作用：响应重命名、卸载、删除文档等系统事件
 * 意图：将消息处理逻辑从类中分离，便于测试和维护
 * 
 * @param forwardlink - Forwardlink 实例
 * @param data - 消息数据，包含 cmd 和具体数据
 */
export function 处理消息回调(
    forwardlink: Forwardlink,
    data: IWebSocketData
): void {
    // 如果消息没有 cmd 字段则忽略
    if (!data.cmd) {
        return;
    }
    const 消息处理映射: Record<string, () => void> = {
        // 文档重命名时更新标签页标题
        "rename": () => {
            if (forwardlink.rootId === data.data.id) {
                forwardlink.parent.updateTitle(data.data.title);
            }
        },
        // 笔记本卸载时关闭标签页
        "unmount": () => {
            if ((forwardlink as any).notebookId === data.data.box && forwardlink.type === "local") {
                forwardlink.parent.parent.removeTab(forwardlink.parent.id);
            }
        },
        // 文档删除时关闭标签页
        "removeDoc": () => {
            if (data.data.ids?.includes(forwardlink.rootId) && forwardlink.type === "local") {
                forwardlink.parent.parent.removeTab(forwardlink.parent.id);
            }
        }
    };
    消息处理映射[data.cmd]?.();
}
