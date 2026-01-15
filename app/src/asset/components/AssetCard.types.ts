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
}

/**
 * AssetCard 组件的事件定义
 * 
 * @usage 定义 AssetCard 组件向父组件发送的事件
 */
export type AssetCardEmit = {
    /** 选中资源时触发 */
    (e: "select", item: AssetItem): void;
    /** 图片加载完成导致高度变化时触发 */
    (e: "heightChange", height: number): void;
};
