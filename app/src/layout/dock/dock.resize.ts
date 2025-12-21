import { Custom } from "./Custom";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import type { Dock } from "./index";

const onMouseMove = (event: MouseEvent, context: {
    dock: Dock,
    direction: "lr" | "tb",
    currentSize: number,
    x: number
}) => {
    event.preventDefault();
    event.stopPropagation();
    const { dock, direction, currentSize, x } = context;
    let currentNowSize: number;

    if (dock.position === "Left") {
        currentNowSize = (currentSize + (event.clientX - x));
    } else if (dock.position === "Right") {
        currentNowSize = (currentSize + (x - event.clientX));
    } else {
        currentNowSize = (currentSize + (x - event.clientY));
    }

    let minSize = 232;
    const fileTrees = Array.from(dock.layout.element.querySelectorAll(".file-tree"));
    for (const item of fileTrees) {
        if (item.classList.contains("sy__backlink") || item.classList.contains("sy__graph")
            || item.classList.contains("sy__globalGraph") || item.classList.contains("sy__inbox")) {
            if (!item.classList.contains("fn__none") && !hasClosestByClassName(item as HTMLElement, "fn__none")) {
                minSize = 320;
                break;
            }
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
    } else {
        dock.layout.element.style.height = currentNowSize + "px";
    }
};

const onMouseUp = (context: { dock: Dock }) => {
    document.onmousemove = null;
    document.onmouseup = null;
    document.ondragstart = null;
    document.onselectstart = null;
    document.onselect = null;
    context.dock.setSize();

    const activeItems = context.dock.element.querySelectorAll(".dock__item--active");
    for (const item of Array.from(activeItems)) {
        const type = item.getAttribute("data-type");
        if (!type) {
            continue;
        }
        const customModel = context.dock.data[type];
        if (customModel && customModel instanceof Custom && customModel.resize) {
            customModel.resize();
        }
    }
};

const onMouseDown = (event: MouseEvent, dock: Dock) => {
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

export const initDockResize = (dock: Dock) => {
    dock.layout.element.querySelector(".layout__dockresize")?.addEventListener("mousedown", (event: MouseEvent) => {
        onMouseDown(event, dock);
    });
};
