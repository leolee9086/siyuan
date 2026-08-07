/** 用途：文件浏览器索引查询契约；使用范围：API 仓储、筛选控制器和结果视图。 */

export interface FileBrowserPaletteSearch {
    color?: [number, number, number];
    tolerance?: number;
    minRatio?: number;
    minH?: number;
    maxH?: number;
    minS?: number;
    maxS?: number;
    minL?: number;
    maxL?: number;
}

export interface FileBrowserSearchRequest {
    keyword?: string;
    rootIDs?: string[];
    allRoots?: boolean;
    /** 相对所选浏览根的目录前缀；用于目录页签而非绝对路径。 */
    pathPrefix?: string;
    /** 额外的相对目录前缀；用于画廊子目录选择的 OR 范围。 */
    pathPrefixes?: string[];
    /** 显式为 false 时只查询当前目录直接文件；省略时保持递归语义。 */
    recursive?: boolean;
    tags?: string[];
    matchAllTags?: boolean;
    palette?: FileBrowserPaletteSearch;
    limit?: number;
    offset?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    minSize?: number;
    maxSize?: number;
    minStar?: number;
    maxStar?: number;
    exts?: string[];
    orderBy?: "name" | "size" | "resolution" | "star" | "updated";
}

export interface FileBrowserPalette {
    color: [number, number, number];
    ratio: number;
    h: number;
    s: number;
    l: number;
}

export interface FileBrowserAssetResult {
    rootID: string;
    path: string;
    name: string;
    tags: string[];
    star: number;
    annotation: string;
    boundBlockId: string;
    source: string;
    sourceId: string;
    importTime: number;
    width: number;
    height: number;
    fileSize: number;
    palettes?: FileBrowserPalette[];
}

export interface FileBrowserSearchResult {
    assets: FileBrowserAssetResult[];
    totalCount: number;
    pageCount: number;
}

export interface FileBrowserQueryRepository {
    search(request: FileBrowserSearchRequest): Promise<FileBrowserSearchResult>;
}
