/**
 * registerBuiltinRenderers.ts - 内置内容渲染器批量注册
 *
 * 作用：将 9 个内置子渲染器注册到 ContentRendererRegistry
 * 意图：提供统一的注册入口，确保所有渲染器在使用前完成注册
 * 调用时机：应用初始化阶段（由 sforge.init.ts 调用）
 *
 * 注意：此文件仅负责注册，不替换任何现有调用方
 */

import { 注册渲染器 } from "./ContentRendererRegistry";

import { abcRender } from "../../protyle/render/abcRender";
import { chartRender } from "../../protyle/render/chartRender";
import { graphvizRender } from "../../protyle/render/graphvizRender";
import { mathRender } from "../../protyle/render/mathRender";
import { mermaidRender } from "../../protyle/render/mermaidRender";
import { mindmapRender } from "../../protyle/render/mindmapRender";
import { flowchartRender } from "../../protyle/render/flowchartRender";
import { plantumlRender } from "../../protyle/render/plantumlRender";
import { htmlRender } from "../../protyle/render/htmlRender";

/**
 * 注册所有内置内容渲染器
 *
 * 作用：将 9 个内置渲染器逐一注册到全局注册表
 * 意图：集中管理注册逻辑，便于维护和排查
 * 调用时机：应用初始化时，在任何渲染器使用之前
 */
export async function registerBuiltinRenderers(): Promise<void> {
    注册渲染器("abc", abcRender);
    注册渲染器("echarts", chartRender);
    注册渲染器("graphviz", graphvizRender);
    注册渲染器("math", mathRender);
    注册渲染器("mermaid", mermaidRender);
    注册渲染器("mindmap", mindmapRender);
    注册渲染器("flowchart", flowchartRender);
    注册渲染器("plantuml", plantumlRender);
    注册渲染器("html", htmlRender);
}
