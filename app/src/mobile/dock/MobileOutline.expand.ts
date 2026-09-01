/**
 * MobileOutline 筛选/展开/折叠/事务相关逻辑
 * 从 MobileOutline.ts 拆分
 */
import {hasClosestBlock, hasClosestByClassName} from "../../protyle/util/hasClosest";
import {setStorageVal} from "../../protyle/util/compatibility";
import {Constants} from "../../constants";
import {MenuItem} from "../../menus/Menu.Item";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import type {
    MobileOutlineExpansionPort,
    MobileOutlineExpansionPersistencePort,
    MobileOutlineFilterPort,
    MobileOutlineKeepCurrentExpandPort,
    MobileOutlineTransactionPort
} from "./outline/ports.types";

/**
 * 获取标题元素的实际标题级别（H1=1, H2=2, 等等）
 * @param element li元素
 * @returns 标题级别（1-6）
 */
export function getHeadingLevel(element: HTMLElement) {
    return parseInt(element.getAttribute("data-subtype")?.replace("h", "") || "0");
}

/**
 * 应用大纲筛选
 */
export function setFilter(outline: MobileOutlineFilterPort) {
    // 还原 display
    outline.element.querySelectorAll('li.b3-list-item[style$="display: none;"]').forEach((item: HTMLElement) => {
        item.style.display = "";
    });
    outline.element.querySelectorAll("ul.fn__none").forEach((item) => {
        item.previousElementSibling.querySelector(".b3-list-item__toggle").classList.remove("fn__hidden");
    });
    const keyword = (outline.element.querySelector("input.b3-text-field.search__label") as HTMLInputElement).value.toLowerCase();
    if (keyword) {
        // 首次筛选时记录折叠状态
        if (!outline.preFilterExpandIds) {
            outline.preFilterExpandIds = outline.tree.getExpandIds();
        }
        const processUL = (ul: Element) => {
            let hasMatch = false;
            let hasChildMatch = false;
            const children = ul.querySelectorAll(":scope > li.b3-list-item");

            children.forEach((liItem: HTMLElement) => {
                const nextUlElement = (liItem.nextElementSibling && liItem.nextElementSibling.tagName === "UL") ? liItem.nextElementSibling as HTMLElement : undefined;

                let childResult = {hasMatch: false, hasChildMatch: false};
                if (nextUlElement) {
                    childResult = processUL(nextUlElement);
                }

                const arrowElement = liItem.querySelector(".b3-list-item__arrow");
                if ((liItem.querySelector(".b3-list-item__text")?.textContent || "").trim().toLowerCase().includes(keyword)) {
                    // 当前标题命中
                    liItem.style.display = "";
                    hasMatch = true;

                    if (nextUlElement) {
                        nextUlElement.classList.remove("fn__none");
                        if (childResult.hasMatch || childResult.hasChildMatch) {
                            // 子项也有命中
                            arrowElement.classList.add("b3-list-item__arrow--open");
                            nextUlElement.classList.remove("fn__none");
                        } else {
                            // 子项无命中，折叠所有子项
                            arrowElement.classList.remove("b3-list-item__arrow--open");
                            arrowElement.parentElement.classList.add("fn__hidden");
                            nextUlElement.classList.add("fn__none");
                        }
                    }
                } else if (childResult.hasMatch || childResult.hasChildMatch) {
                    // 当前标题未命中，但子级有命中
                    liItem.style.display = "";
                    hasChildMatch = true;

                    if (nextUlElement) {
                        nextUlElement.classList.remove("fn__none");
                        arrowElement.classList.add("b3-list-item__arrow--open");
                    }
                } else {
                    // 当前标题和子级都未命中，隐藏
                    liItem.style.display = "none";
                    if (nextUlElement) {
                        nextUlElement.classList.add("fn__none");
                    }
                }
            });
            return {hasMatch, hasChildMatch};
        };

        processUL(outline.element.lastElementChild.firstElementChild);
        return;
    }
    // 恢复折叠状态
    outline.tree.setExpandIds(outline.preFilterExpandIds);
    outline.preFilterExpandIds = null;
}

/**
 * 展开到指定标题级别
 * @param targetLevel 目标标题级别，1-6级（H1-H6），6级表示全部展开
 */
export function expandToLevel(outline: MobileOutlineExpansionPort, targetLevel: number) {
    if (targetLevel >= 6) {
        // 全部展开
        outline.tree.expandAll();
        outline.saveExpendIds();
        window.siyuan.storage[Constants.LOCAL_OUTLINE].expandLevel = targetLevel;
        setStorageVal(Constants.LOCAL_OUTLINE, window.siyuan.storage[Constants.LOCAL_OUTLINE]);
        return;
    } else {
        // 展开到指定标题级别
        outline.element.querySelectorAll("li.b3-list-item").forEach(item => {
            const headingLevel = getHeadingLevel(item as HTMLElement);
            const arrowElement = item.querySelector(".b3-list-item__arrow");
            if (item.nextElementSibling && item.nextElementSibling.tagName === "UL" && arrowElement) {
                if (headingLevel > 0 && headingLevel < targetLevel) {
                    // 当前标题级别小于目标级别，展开
                    arrowElement.classList.add("b3-list-item__arrow--open");
                    item.nextElementSibling.classList.remove("fn__none");
                } else if (headingLevel >= targetLevel) {
                    // 当前标题级别大于等于目标级别，折叠
                    arrowElement.classList.remove("b3-list-item__arrow--open");
                    item.nextElementSibling.classList.add("fn__none");
                }
            }
        });
    }
    outline.saveExpendIds();
    window.siyuan.storage[Constants.LOCAL_OUTLINE].expandLevel = targetLevel;
    setStorageVal(Constants.LOCAL_OUTLINE, window.siyuan.storage[Constants.LOCAL_OUTLINE]);
}

/**
 * 显示展开层级菜单
 */
export function showExpandLevelMenu(outline: MobileOutlineExpansionPort) {
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_OUTLINE_EXPAND_LEVEL);
    for (let i = 1; i <= 6; i++) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: `heading${i}`,
            icon: `iconH${i}`,
            label: siyuanI18n[`heading${i}`],
            current: window.siyuan.storage[Constants.LOCAL_OUTLINE].expandLevel === i,
            click: () => expandToLevel(outline, i)
        }).element);
    }
    window.siyuan.menus.menu.fullscreen("bottom");
    return window.siyuan.menus.menu;
}

/**
 * 切换同层级的所有标题的展开/折叠状态（基于标题级别而不是DOM层级）
 */
export function collapseSameLevel(outline: MobileOutlineExpansionPort, element: HTMLElement, expand?: boolean) {
    // 获取所有相同标题级别的元素
    outline.element.querySelectorAll(`li.b3-list-item[data-subtype="${element.getAttribute("data-subtype")}"]`).forEach(item => {
        const arrowElement = item.querySelector(".b3-list-item__arrow");
        if (typeof expand === "undefined") {
            expand = !element.querySelector(".b3-list-item__arrow").classList.contains("b3-list-item__arrow--open");
        }
        if (expand) {
            if (item.nextElementSibling && item.nextElementSibling.tagName === "UL") {
                item.nextElementSibling.classList.remove("fn__none");
                arrowElement.classList.add("b3-list-item__arrow--open");
            }
            let ulElement = item.parentElement;
            while (ulElement && !ulElement.classList.contains("b3-list") && ulElement.tagName === "UL") {
                ulElement.classList.remove("fn__none");
                ulElement.previousElementSibling.querySelector(".b3-list-item__arrow").classList.add("b3-list-item__arrow--open");
                ulElement = ulElement.parentElement;
            }
        } else {
            if (item.nextElementSibling && item.nextElementSibling.tagName === "UL") {
                item.nextElementSibling.classList.add("fn__none");
                arrowElement.classList.remove("b3-list-item__arrow--open");
            }
        }
    });
    outline.saveExpendIds();
}

/**
 * 折叠/展开子标题
 */
export function collapseChildren(outline: MobileOutlineExpansionPersistencePort, element: HTMLElement, expand?: boolean) {
    const nextElement = element.nextElementSibling;
    if (!nextElement || nextElement.tagName !== "UL") {
        return;
    }
    const arrowElement = element.querySelector(".b3-list-item__arrow");
    if (typeof expand === "undefined") {
        expand = !arrowElement.classList.contains("b3-list-item__arrow--open");
    }
    if (expand) {
        arrowElement.classList.add("b3-list-item__arrow--open");
        nextElement.classList.remove("fn__none");
        nextElement.querySelectorAll("ul").forEach(item => {
            item.previousElementSibling.querySelector(".b3-list-item__arrow").classList.add("b3-list-item__arrow--open");
            item.classList.remove("fn__none");
        });
    } else {
        arrowElement.classList.remove("b3-list-item__arrow--open");
        nextElement.classList.add("fn__none");
    }
    outline.saveExpendIds();
}

/**
 * 处理WebSocket事务，检测标题变更并刷新大纲
 */
export function handleOutlineTransaction(outline: MobileOutlineTransactionPort, data: IWebSocketData) {
    if (data.data.rootID !== outline.blockId) {
        return;
    }
    let needReload = false;
    const ops = data.data.sources[0];
    ops.doOperations.find((item: IOperation) => {
        if (item.action === "update" &&
            (outline.element.querySelector(`.b3-list-item[data-node-id="${item.id}"]`) || item.data.indexOf('data-type="NodeHeading"') > -1)) {
            needReload = true;
            return true;
        } else if (item.action === "insert" && item.data.indexOf('data-type="NodeHeading"') > -1) {
            needReload = true;
            return true;
        } else if (item.action === "delete" || item.action === "move") {
            needReload = true;
            return true;
        }
    });
    if (!needReload && ops.undoOperations) {
        ops.undoOperations.find((item: IOperation) => {
            if (item.action === "update" && item.data?.indexOf('data-type="NodeHeading"') > -1) {
                needReload = true;
                return true;
            }
        });
    }
    if (needReload) {
        outline.reload(() => {
            // https://github.com/siyuan-note/siyuan/issues/8372
            if (getSelection().rangeCount > 0) {
                const blockElement = hasClosestBlock(getSelection().getRangeAt(0).startContainer);
                if (blockElement && blockElement.getAttribute("data-type") === "NodeHeading") {
                    outline.setCurrent(blockElement);
                }
            }
        });
    }
}

/**
 * 绑定keepCurrentExpand按钮事件
 */
export function bindKeepCurrentExpandEvent(outline: MobileOutlineKeepCurrentExpandPort) {
    outline.element.querySelector('[data-type="keepCurrentExpand"]').addEventListener("click", (event: MouseEvent & {
        target: Element
    }) => {
        const iconElement = hasClosestByClassName(event.target, "toolbar__icon");
        if (!iconElement) {
            return;
        }
        if (iconElement.classList.contains("toolbar__icon--active")) {
            iconElement.classList.remove("toolbar__icon--active");
            window.siyuan.storage[Constants.LOCAL_OUTLINE].keepCurrentExpand = false;
        } else {
            iconElement.classList.add("toolbar__icon--active");
            window.siyuan.storage[Constants.LOCAL_OUTLINE].keepCurrentExpand = true;
            let focusElement;
            const blockElement = hasClosestBlock(window.siyuan.mobile.editor.protyle.toolbar.range?.startContainer);
            if (blockElement) {
                focusElement = blockElement;
            }
            if (focusElement) {
                outline.setCurrent(focusElement);
            }
        }
        // 保存keepCurrentExpand状态到localStorage
        setStorageVal(Constants.LOCAL_OUTLINE, window.siyuan.storage[Constants.LOCAL_OUTLINE]);
    });
}
