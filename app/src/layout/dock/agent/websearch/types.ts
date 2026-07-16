/** Native Agent search progress received from the tool_progress SSE event. */
export type AgentWebSearchProgress = {
    phase: string;
    done: number;
    total: number;
    current?: string;
    partialCount?: number;
    latestResults?: Array<{title: string; url: string; engine: string}>;
};

/** Structured search response persisted by the native web_search tool. */
export type AgentWebSearchResponse = {
    query?: string;
    provider?: string;
    results?: Array<{
        title?: string;
        url?: string;
        snippet?: string;
        engines?: string[];
    }>;
    usedEngines?: string[];
    errors?: Array<{engine?: string; message?: string}>;
    noResults?: boolean;
};
