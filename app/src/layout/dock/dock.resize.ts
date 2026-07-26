import {isCustomDomain} from "./custom/custom.types";
import { hasClosestByClassName } from "./imports";
import type {DockDomain} from "./dock.types";

const onMouseMove = (event: MouseEvent, context: {
    dock: DockDomain,
    direction: "lr" | "tb",
    currentSize: number,
    x: number
}) => {
    event.preventDefault();
    event.stopPropagation();
    const { dock, direction, currentSize, x } = context;
    let currentNowSize = currentSize + (x - event.clientY);
    if (dock.position === "Left") {
        currentNowSize = currentSize + (event.clientX - x);
    }
    if (dock.position === "Right") {
        currentNowSize = currentSize + (x - event.clientX);
    }

    let minSize = 232;
    const fileTrees = Array.from(dock.layout.element.querySelectorAll(".file-tree"));
    for (const item of fileTrees) {
        if ((item.classList.contains("sy__backlink") || item.classList.contains("sy__graph")
            || item.classList.contains("sy__globalGraph") || item.classList.contains("sy__inbox"))
            && !item.classList.contains("fn__none") && (item instanceof HTMLElement) && !hasClosestByClassName(item, "fn__none")) {
            minSize = 320;
            break;
        }
    }

    if (direction === "lr" && currentNowSize < minSize) {
        return;
    }
    if (direction === "tb" && currentNowSize < 64) {
        return;
    }

    if (direction === "lr") {
        dock.layout.element.style.width = currentNowSize + "px";
        return;
    }
    dock.layout.element.style.height = currentNowSize + "px";
};

const onMouseUp = (context: { dock: DockDomain }) => {
    document.onmousemove = null;
    document.onmouseup = null;
    document.ondragstart = null;
    document.onselectstart = null;
    document.onselect = null;
    context.dock.setSize();

    const activeItems = context.dock.layout.element.querySelectorAll(".dock__item--active");
    for (const item of Array.from(activeItems)) {
        const type = item.getAttribute("data-type");
        if (!type) {
            continue;
        }
        const customModel = context.dock.data[type];
        // 只有完整 Custom 领域模型声明了可选 resize 生命周期，布尔占位和其它模型跳过。
        if (typeof customModel === "object" && customModel !== null && isCustomDomain(customModel) && customModel.resize) {
            customModel.resize();
        }
    }
};

const onMouseDown = (event: MouseEvent, dock: DockDomain) => {
    const direction = dock.position === "Bottom" ? "tb" : "lr";
    const x = event[direction === "lr" ? "clientX" : "clientY"];
    const currentSize = direction === "lr" ? dock.layout.element.clientWidth : dock.layout.element.clientHeight;

    document.onmousemove = (moveEvent: MouseEvent) => {
        onMouseMove(moveEvent, { dock, direction, currentSize, x });
    };

    document.onmouseup = () => {
        onMouseUp({ dock });
    };
};

export const initDockResize = (dock: DockDomain) => {
    const resizeHandle = dock.layout.element.querySelector(".layout__dockresize");
    if (!resizeHandle || !(resizeHandle instanceof HTMLElement)) {
        return;
    }
    resizeHandle.addEventListener("mousedown", (event: MouseEvent) => {
        onMouseDown(event, dock);
    });
};
