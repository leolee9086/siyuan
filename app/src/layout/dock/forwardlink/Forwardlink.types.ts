/**
 * 正向链接树节点数据
 * 
 * - 用途：表示正向链接面板树状结构中的单个节点
 * - 使用场景：Tree 组件渲染、节点展开/折叠操作
 * - 关联类型：由 ISqlResultItem 转换而来
 */
export interface IForwardlinkTreeNode {
    id: string;
    name: string;
    type: string;
    subType?: string;
    box: string;
    hPath: string;
    count: number;
    children?: IForwardlinkTreeNode[];
    ial?: { [key: string]: string };
    icon?: string;
}

/**
 * 单个正向链接面板状态项
 * 
 * - 用途：保存某个文档对应的正向链接面板 UI 状态
 * - 使用场景：用户切换文档时恢复之前的展开/折叠和滚动状态
 * - 关联类型：作为 IForwardlinkStatus 的值类型
 */
export interface IForwardlinkStatusItem {
    sort: number;
    scrollTop: number;
    forwardlinkOpenIds: string[];
}

/**
 * 正向链接面板状态字典
 * - 用途：以 rootId 为键存储多个文档的面板状态
 * - 使用场景：在 Forwardlink 组件中持久化和恢复 UI 状态
 * - 关联类型：值为 IForwardlinkStatusItem
 */
export interface IForwardlinkStatus {
    [key: string]: IForwardlinkStatusItem;
}

/**
 * SQL 查询返回的正向链接原始数据项
 * 
 * - 用途：表示从数据库查询返回的单条正向链接记录
 * - 使用场景：searchForwardLinks 函数内部处理 SQL 查询结果时使用
 * - 关联类型：会被转换为 IForwardlinkTreeNode 供 UI 层使用
 */
export interface ISqlResultItem {
    id: string;
    name: string;
    type: string;
    box: string;
    hPath: string;
    ial: string;
    refCount: number;
}

/**
 * 块查询结果项
 * 
 * - 用途：表示从数据库查询返回的单个块信息
 * - 使用场景：fetchBlocks 函数返回的块列表中的每个元素
 * - 关联类型：由 UI 层渲染为列表项
 */
export interface IBlockResult {
    id: string;
    content: string;
    type: string;
    subType: string;
    box: string;
}
