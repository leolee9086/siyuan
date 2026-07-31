export type BacklinkRefreshScope =
    | Readonly<{kind: "all"}>
    | Readonly<{
        kind: "targeted";
        rootId: string;
        relatedBlockIds: readonly string[];
        includeRootDescendants: boolean;
    }>;

export type BacklinkRefreshCause = "dynamic-ref-text" | "ref-count" | "rename" | "sync" | "transactions";

export type BacklinkRefreshRequest = Readonly<{
    cause: BacklinkRefreshCause;
    scope: BacklinkRefreshScope;
}>;
