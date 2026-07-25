/**
 * dock.graph.ts - Dock Graph 面板相关逻辑
 */
/** 用途：约束 Graph 行为的 Dock 宿主；使用范围：显示、销毁和全屏拖动条；解耦评估：完整 DockDomain 已由具体 class 契约测试校验。 */
import type {DockDomain} from "../dock.types";
/** 用途：识别 Graph 领域模型；使用范围：Dock 数据分派；解耦评估：结构守卫替代具体 Graph class 的运行时导入。 */
import {isGraphDomain} from "./graph.guard";

/**
 * 处理 Graph 类型面板的销毁。
 * @同步豁免: UI构建 - Dock 关闭流程必须在同一事件栈内释放图网络并恢复拖动条。
 */
export function handleGraphDestroy(
    type: string,
    dock: DockDomain
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
    // 仅完整 Graph 领域模型拥有可释放的图网络资源。
    if (isGraphDomain(graph)) {
        graph.destroy();
    }
}

/**
 * 处理 Graph 显示。
 * @同步豁免: UI构建 - Dock 切换完成后必须立即触发当前图模型渲染。
 */
export function handleGraphShow(type: string, dock: DockDomain) {
    if (type !== "graph" && type !== "globalGraph") {
        return;
    }

    const graph = dock.data[type];
    // 仅完整 Graph 领域模型响应显示后的图刷新。
    if (isGraphDomain(graph)) {
        graph.onGraph(false);
    }
}

/**
 * 处理全屏 Graph 的拖动条显示/隐藏。
 * @同步豁免: UI构建 - 全屏切换要求在当前 DOM 更新阶段同步改变拖动条可见性。
 */
export function handleGraphFullscreenDrag(type: string, dock: DockDomain, show: boolean) {
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
