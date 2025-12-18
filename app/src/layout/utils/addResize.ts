import { Layout } from "..";
import { focusByRange } from "../../ai/imports";
import { hideElements } from "../../protyle/ui/hideElements";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { isWindow } from "../../util/functions";
import { getAllModels } from "../getAll";
import { resizeTabs } from "../tabUtil";
import { adjustLayout } from "../util";
import { Wnd } from "../Wnd";


export const addResize = (obj: Layout | Wnd) => {
    if (!obj.resize) {
        return;
    }

    const getMinSize = (element: HTMLElement) => {
        let minSize = 232;
        Array.from(element.querySelectorAll(".file-tree")).find((item) => {
            if (item.classList.contains("sy__backlink") || item.classList.contains("sy__graph")
                || item.classList.contains("sy__globalGraph") || item.classList.contains("sy__inbox")) {
                if (!item.classList.contains("fn__none") && !hasClosestByClassName(item, "fn__none")) {
                    minSize = 320;
                    return true;
                }
            }
        });
        return minSize;
    };

    const resizeWnd = (resizeElement: HTMLElement, direction: string) => {
        const setSize = (item: HTMLElement, direction: string) => {
            if (item.classList.contains("fn__flex-1")) {
                if (direction === "lr") {
                    item.style.width = item.clientWidth + "px";
                } else {
                    item.style.height = item.clientHeight + "px";
                }
                item.classList.remove("fn__flex-1");
            }
        };

        let range: Range;
        resizeElement.addEventListener("mousedown", (event: MouseEvent) => {
            getAllModels().editor.forEach((item) => {
                if (item.editor && item.editor.protyle && item.element.parentElement) {
                    hideElements(["gutter"], item.editor.protyle);
                }
            });

            if (getSelection().rangeCount > 0) {
                range = getSelection().getRangeAt(0);
            }
            const documentSelf = document;
            const nextElement = resizeElement.nextElementSibling as HTMLElement;
            const previousElement = resizeElement.previousElementSibling as HTMLElement;
            nextElement.style.overflow = "auto"; // 拖动时 layout__resize 会出现 https://github.com/siyuan-note/siyuan/issues/6221
            previousElement.style.overflow = "auto";
            nextElement.style.transition = "none";
            previousElement.style.transition = "none";
            if (!nextElement.nextElementSibling || nextElement.nextElementSibling.classList.contains("layout__dockresize")) {
                setSize(nextElement, direction);
            } else {
                setSize(previousElement, direction);
            }
            const x = event[direction === "lr" ? "clientX" : "clientY"];
            const previousSize = direction === "lr" ? previousElement.clientWidth : previousElement.clientHeight;
            const nextSize = direction === "lr" ? nextElement.clientWidth : nextElement.clientHeight;

            documentSelf.ondragstart = () => {
                // 文件树拖拽会产生透明效果
                document.querySelectorAll(".sy__file .b3-list-item").forEach((item: HTMLElement) => {
                    if (item.style.opacity === "0.38") {
                        item.style.opacity = "";
                    }
                });
                return false;
            };

            documentSelf.onmousemove = (moveEvent: MouseEvent) => {
                moveEvent.preventDefault();
                moveEvent.stopPropagation();
                const previousNowSize = (previousSize + (moveEvent[direction === "lr" ? "clientX" : "clientY"] - x));
                const nextNowSize = (nextSize - (moveEvent[direction === "lr" ? "clientX" : "clientY"] - x));
                if (previousNowSize < 8 || nextNowSize < 8) {
                    return;
                }
                if (window.siyuan.layout.leftDock && window.siyuan.layout.leftDock.layout.element === previousElement &&
                    previousNowSize < getMinSize(previousElement) &&
                    // https://github.com/siyuan-note/siyuan/issues/10506
                    previousNowSize < previousSize) {
                    return;
                }
                if (window.siyuan.layout.rightDock && window.siyuan.layout.rightDock.layout.element === nextElement &&
                    nextNowSize < getMinSize(nextElement) && nextNowSize < nextSize) {
                    return;
                }
                if (window.siyuan.layout.bottomDock && window.siyuan.layout.bottomDock.layout.element === nextElement &&
                    nextNowSize < 64 && nextNowSize < nextSize) {
                    return;
                }
                if (!previousElement.classList.contains("fn__flex-1")) {
                    previousElement.style[direction === "lr" ? "width" : "height"] = previousNowSize + "px";
                }
                if (!nextElement.classList.contains("fn__flex-1")) {
                    nextElement.style[direction === "lr" ? "width" : "height"] = nextNowSize + "px";
                }
            };

            documentSelf.onmouseup = () => {
                documentSelf.onmousemove = null;
                documentSelf.onmouseup = null;
                documentSelf.ondragstart = null;
                documentSelf.onselectstart = null;
                documentSelf.onselect = null;
                adjustLayout(isWindow() ? window.siyuan.layout.centerLayout : undefined);
                resizeTabs();
                if (!isWindow()) {
                    window.siyuan.layout.leftDock.setSize();
                    window.siyuan.layout.bottomDock.setSize();
                    window.siyuan.layout.rightDock.setSize();
                }
                if (range) {
                    focusByRange(range);
                }
                nextElement.style.overflow = "";
                previousElement.style.overflow = "";
                nextElement.style.transition = "";
                previousElement.style.transition = "";
            };
        });
    };

    const resizeElement = document.createElement("div");
    if (obj.resize === "lr") {
        resizeElement.classList.add("layout__resize--lr");
    }
    resizeElement.classList.add("layout__resize");
    obj.element.insertAdjacentElement("beforebegin", resizeElement);
    resizeWnd(resizeElement, obj.resize);

    resizeElement.addEventListener("dblclick", () => {
        const previousElement = resizeElement.previousElementSibling as HTMLElement;
        const nextElement = resizeElement.nextElementSibling as HTMLElement;
        if (previousElement && nextElement) {
            const bigType = ["graph", "inbox", "globalGraph", "backlink"];
            let size = 232;
            nextElement.style.transition = "none";
            previousElement.style.transition = "none";
            if (resizeElement.classList.contains("layout__resize--lr")) {
                if (previousElement.classList.contains("layout__dockl")) {
                    document.querySelectorAll("#dockLeft .dock__item--active").forEach(item => {
                        if (bigType.includes(item.getAttribute("data-type"))) {
                            size = 320;
                        }
                    });
                    previousElement.style.width = size + "px";
                    window.siyuan.layout.leftDock.setSize();
                } else if (nextElement.classList.contains("layout__dockr")) {
                    document.querySelectorAll("#dockRight .dock__item--active").forEach(item => {
                        if (bigType.includes(item.getAttribute("data-type"))) {
                            size = 320;
                        }
                    });
                    nextElement.style.width = size + "px";
                    window.siyuan.layout.rightDock.setSize();
                } else {
                    previousElement.style.width = "";
                    nextElement.style.width = "";
                    previousElement.classList.add("fn__flex-1");
                    nextElement.classList.add("fn__flex-1");
                    if (resizeElement.parentElement.classList.contains("layout__dockb")) {
                        window.siyuan.layout.bottomDock.setSize();
                    }
                }
            } else {
                if (nextElement.classList.contains("layout__dockb")) {
                    nextElement.style.height = "232px";
                    window.siyuan.layout.bottomDock.setSize();
                } else {
                    previousElement.style.height = "";
                    nextElement.style.height = "";
                    previousElement.classList.add("fn__flex-1");
                    nextElement.classList.add("fn__flex-1");
                    if (resizeElement.parentElement.classList.contains("layout__dockl")) {
                        window.siyuan.layout.leftDock.setSize();
                    } else if (resizeElement.parentElement.classList.contains("layout__dockr")) {
                        window.siyuan.layout.rightDock.setSize();
                    }
                }
            }
            resizeTabs();
            nextElement.style.transition = "";
            previousElement.style.transition = "";
        }
    });
};
