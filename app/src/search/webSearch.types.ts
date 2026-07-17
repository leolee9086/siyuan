/**
 * 用途：为搜索控制器提供文档编辑器的类型边界。
 * 使用范围：仅用于把网络结果写入当前文档或日记的 UI 操作。
 * 解耦评估：这是现有编辑器 API 的类型依赖，运行时不导入模块，可由调用方传入编辑器实例。
 */
import type {Protyle} from "../protyle";

/** Structured result returned by the human-facing web search endpoint. */
export interface HumanWebSearchResult {
    title: string;
    url: string;
    snippet: string;
    engines: string[];
    publishedDate?: number;
}

/** Structured response shared by the human search view and result actions. */
export interface HumanWebSearchResponse {
    query: string;
    provider: string;
    results?: HumanWebSearchResult[];
    usedEngines?: string[];
    errors?: Array<{engine: string; message: string}>;
    noResults?: boolean;
}

/** HTTP envelope returned by the regular human-facing search endpoint. */
export interface SearchEnvelope {
    code: number;
    msg?: string;
    data?: HumanWebSearchResponse;
}

/** DOM references owned by the human-facing web search controller. */
export interface WebSearchElements {
    root: HTMLElement;
    sourceLocal: HTMLElement;
    sourceWeb: HTMLElement;
    webPanel: HTMLElement;
    status: HTMLElement;
    results: HTMLElement;
    input: HTMLInputElement;
    runButton: HTMLButtonElement;
    provider: HTMLSelectElement;
    queryType: HTMLSelectElement;
    timeRange: HTMLSelectElement;
    localOnly: NodeListOf<Element>;
}

/** Mutable request state kept separate from the local search controller. */
export interface WebSearchState {
    elements: WebSearchElements;
    config: Config.IUILayoutTabSearchConfig;
    edit: Protyle;
    webMode: boolean;
    runSerial: number;
    timer: number;
    currentResults: HumanWebSearchResult[];
    runSearch: () => Promise<void>;
}
