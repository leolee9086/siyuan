/**
 * 资源项接口
 * 用于表示文件系统中的一个资源文件
 * 
 * @usage 在 AssetCard 和相关列表中使用，表示单个资源的数据结构
 */
export interface AssetItem {
    /** 文件名（通常用于显示） */
    hName: string;
    /** 文件路径 */
    path: string;
    /** 该资源在当前业务入口下唯一有效的缩略图地址。 */
    thumbnailUrl: string;
}

