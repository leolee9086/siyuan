/**
 * render.types.ts - Protyle 渲染模块的共享类型定义
 *
 * 汇总各渲染器（ABC 记谱、嵌入块搜索、Mermaid 图表）所需的类型声明，
 * 便于在渲染模块内统一引用。
 *
 * @module protyle/render/render.types
 */

// ============================================================================
// ABC 记谱渲染
// ============================================================================

/**
 * ABC 记谱渲染参数类型
 *
 * abcjs renderAbc 的 options 参数，用户可通过 %%params 首行自定义
 */
export interface AbcRenderParams {
    responsive: string;
    [key: string]: unknown;
}

// ============================================================================
// 嵌入块搜索渲染
// ============================================================================

/** 搜索上下文参数 */
export interface SearchContext {
    protyle: IProtyle;
    item: HTMLElement;
    content: string;
    breadcrumb: boolean;
    top?: number | undefined;
    onEmbedRender?: () => void;
}

/** 语义搜索结果项 */
export interface SemanticSearchResultItem {
    blockId: string;
    content?: string;
    hpath?: string;
    type?: string;
    box?: string;
    rootID?: string;
    name?: string;
    alias?: string;
    memo?: string;
    tag?: string;
    ial?: string;
    score: number;
}

// ============================================================================
// Mermaid 图表渲染
// ============================================================================

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
