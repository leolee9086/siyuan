import { hideDragTip } from "../dragTip";

export const addDragover = (element: HTMLElement) => {
    if (element.classList.contains("sb") ||
        element.classList.contains("li") ||
        element.classList.contains("list") ||
        element.classList.contains("bq")) {
        element.classList.add("dragover");
    }
    highlightColColumn(element);
};

export const highlightColColumn = (element: HTMLElement) => {
    if (element.getAttribute("data-sb-layout") === "col") {
        element.classList.add("dragover");
    }
};

export const cleanupDragIndicators = (scope: ParentNode) => {
    scope.querySelectorAll(
        ".dragover__top, .dragover__bottom, .dragover__left, .dragover__right, " +
        ".dragover__top--sibling, .dragover__bottom--sibling, .dragover__top--child, " +
        ".dragover__bottom--child, .dragover, [style*=\"--drag-indent\"]"
    ).forEach((item: HTMLElement) => {
        item.classList.remove(
            "dragover__top",
            "dragover__bottom",
            "dragover__left",
            "dragover__right",
            "dragover",
            "dragover__top--sibling",
            "dragover__bottom--sibling",
            "dragover__top--child",
            "dragover__bottom--child"
        );
        item.style.removeProperty("--drag-indent");
        item.style.removeProperty("--drag-guides");
        item.style.removeProperty("--drag-line-left");
        item.style.removeProperty("--drag-base-bg");
        item.style.removeProperty("--drag-line-bg");
        item.style.removeProperty("--b3-av-kanban-drag-height");
    });
};

export const getListDepth = (liElement: Element): number => {
    let depth = 0;
    let list = liElement.parentElement;
    while (list && list.classList.contains("list")) {
        const parentLi = list.parentElement;
        if (!parentLi?.classList.contains("li")) {
            break;
        }
        depth++;
        list = parentLi.parentElement;
    }
    return depth;
};

export const parseHexColor = (color: string): { r: number, g: number, b: number } | null => {
    if (!color) {
        return null;
    }
    const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        if (hex.length >= 6) {
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16),
            };
        }
    }
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1]),
            g: parseInt(rgbMatch[2]),
            b: parseInt(rgbMatch[3]),
        };
    }
    return null;
};

export const highlightByLevel = (editorElement: HTMLElement, liElement: HTMLElement) => {
    editorElement.querySelectorAll(".dragover").forEach((item: HTMLElement) => {
        item.classList.remove("dragover");
    });
    liElement.classList.add("dragover");
};

// https://github.com/siyuan-note/siyuan/issues/12651
export const clearDragoverElement = (element?: Element | null) => {
    if (element) {
        element.classList.remove(
            "dragover__top",
            "dragover__bottom",
            "dragover",
            "dragover__left",
            "dragover__right",
            "dragover__top--sibling",
            "dragover__bottom--sibling",
            "dragover__top--child",
            "dragover__bottom--child"
        );
        const htmlElement = element as HTMLElement;
        htmlElement.style.removeProperty("--drag-indent");
        htmlElement.style.removeProperty("--drag-guides");
        htmlElement.style.removeProperty("--drag-line-left");
        htmlElement.style.removeProperty("--drag-base-bg");
        htmlElement.style.removeProperty("--drag-line-bg");
        htmlElement.style.removeProperty("--b3-av-kanban-drag-height");
    }
    hideDragTip();
};
