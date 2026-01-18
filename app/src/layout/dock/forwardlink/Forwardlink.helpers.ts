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
import type { Forwardlink } from "./Forwardlink";

/**
 * 设置面板焦点
 * @param forwardlink - Forwardlink 实例
 */
export function 设置面板焦点(forwardlink: Forwardlink): void {
    // local 类型的面板嵌入在标签页的内层容器中，DOM 层级为: element -> panelElement -> Tab
    // 需要向上查找两级获取真正的面板容器；而 pin 类型直接挂载在 Dock 根元素上，element 本身即为容器
    const panelElement = forwardlink.element.parentElement?.parentElement;
    // local 类型时，需要向上两级获取面板容器；同时需确保 panelElement 存在以避免空引用
    if (forwardlink.type === "local" && panelElement) {
        setPanelFocus(panelElement);
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
export async function 获取并渲染块列表(forwardlink: Forwardlink, liElement: HTMLElement, docId: string): Promise<void> {
    const blocks = await fetchBlocks(forwardlink.rootId, docId);
    // 无块数据时不渲染
    if (blocks.length === 0) {
        return;
    }

    const wrapper = document.createElement("li");
    wrapper.setAttribute("data-type", "wrapper");
    wrapper.style.display = "block";

    const ul = document.createElement("ul");
    ul.className = "b3-list b3-list--background";

    let html = "";
    for (const block of blocks) {
        const icon = getIconByType(block.type, block.subType);
        // CustomLists 使用 mapBlockToTreeData 处理
        html += `<li data-node-id="${block.id}" data-type="${block.type}" data-subtype="${block.subType || ""}" class="b3-list-item b3-list-item--hide-action">
            <span class="b3-list-item__toggle"><svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg></span>
            <svg class="b3-list-item__graphic"><use xlink:href="#${icon}"></use></svg>
            <span class="b3-list-item__text">${block.content || "无内容"}</span>
        </li>`;
    }
    ul.innerHTML = html;
    wrapper.appendChild(ul);
    liElement.after(wrapper);
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

    // 通过箭头图标是否带有 "b3-list-item__arrow--open" 类来判断当前展开状态
    // 有该类表示已展开 → 执行折叠并提前返回
    if (svgElement.classList.contains("b3-list-item__arrow--open")) {
        svgElement.classList.remove("b3-list-item__arrow--open");
        折叠列表项(forwardlink, liElement);
        return;
    }

    // 主流程：已折叠 → 执行展开并渲染内容
    svgElement.classList.add("b3-list-item__arrow--open");

    // NodeDocument 类型需要获取其下属块列表进行渲染
    if (type === "NodeDocument") {
        获取并渲染块列表(forwardlink, liElement, id);
        return;
    }
    // 其他块类型直接渲染 Protyle 编辑器
    渲染块编辑器(forwardlink, liElement, id);
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
export async function 执行正向链接搜索(forwardlink: Forwardlink, init = false): Promise<void> {
    const element = forwardlink.element.querySelector('.block__icon[data-type="refresh"] svg');
    // 正在加载中，避免重复触发
    if (element?.classList.contains("fn__rotate")) {
        return;
    }
    element?.classList.add("fn__rotate");

    // 无 rootId 时直接渲染空状态
    if (!forwardlink.rootId) {
        element?.classList.remove("fn__rotate");
        forwardlink.渲染数据({ forwardlinks: [], count: 0 });
        return;
    }

    const keyword = forwardlink.inputsElement[0]?.value || "";
    const sortAttr = forwardlink.tree.element.previousElementSibling?.querySelector('[data-type="sort"]')?.getAttribute("data-sort") || "0";

    const data = await searchForwardLinks(forwardlink.rootId, keyword, sortAttr);
    // 非初始化时保存当前状态
    if (!init) {
        forwardlink.保存状态();
    }
    forwardlink.渲染数据(data);
}
