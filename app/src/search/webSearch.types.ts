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
export interface WebSearchState<TEditor> {
    elements: WebSearchElements;
    config: Config.IUILayoutTabSearchConfig;
    edit: TEditor;
    webMode: boolean;
    runSerial: number;
    timer: number;
    currentResults: HumanWebSearchResult[];
    runSearch: () => Promise<void>;
}
