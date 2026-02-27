/**
 * mermaidRender.types.ts - Mermaid 渲染模块的类型定义
 *
 * @module protyle/render/mermaidRender.types
 */

/** Mermaid 初始化配置 */
export interface MermaidConfig {
    securityLevel: string;
    altFontFamily: string;
    fontFamily: string;
    startOnLoad: boolean;
    theme?: string;
    flowchart: { htmlLabels: boolean; useMaxWidth: boolean };
    sequence: {
        useMaxWidth: boolean;
        diagramMarginX: number;
        diagramMarginY: number;
        boxMargin: number;
        showSequenceNumbers: boolean;
    };
    gantt: { leftPadding: number; rightPadding: number };
}
