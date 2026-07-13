/**
 * dock.graph.ts - Dock Graph 面板相关逻辑
 */
import type { Dock } from "./index";
import { Graph } from "./Graph";

/**
 * 处理 Graph 类型面板的销毁
 */
export function handleGraphDestroy(
    type: string,
    dock: Dock
) {
    if (type !== "graph" && type !== "globalGraph") {
        return;
    }

    const fullscreenElement = dock.layout.element.querySelector(".fullscreen");
    if (fullscreenElement) {
        const dragElement = document.getElementById("drag");
        dragElement?.classList.remove("fn__hidden");
    }

    const graph = dock.data[type];
    if (graph instanceof Graph) {
        graph.destroy();
    }
}

/**
 * 处理 Graph 显示
 */
export function handleGraphShow(type: string, dock: Dock) {
    if (type !== "graph" && type !== "globalGraph") {
        return;
    }

    const graph = dock.data[type];
    if (graph instanceof Graph) {
        graph.onGraph(false);
    }
}

/**
 * 处理全屏 Graph 的拖动条显示/隐藏
 */
export function handleGraphFullscreenDrag(type: string, dock: Dock, show: boolean) {
    if (type !== "graph" && type !== "globalGraph") {
        return;
    }

    const fullscreenElement = dock.layout.element.querySelector(".fullscreen");
    if (!fullscreenElement) {
        return;
    }

    const dragElement = document.getElementById("drag");
    if (!dragElement) {
        return;
    }

    const method = show ? "add" : "remove";
    dragElement.classList[method]("fn__hidden");
}
