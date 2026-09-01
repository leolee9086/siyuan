/** 在当前宿主中打开工作空间资产所需的稳定领域参数。 */
export interface AssetOpenOptions {
    assetPath: string;
    page?: number | string;
    position?: string | null;
    keepCursor?: boolean;
}
