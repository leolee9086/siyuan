/**
 * 自定义列表的基础配置字段
 */
export interface ICustomListBase {
    id: string;
    title: string;
    icon: string;
}

/**
 * 动态列表（基于搜索/SQL 查询）
 * type 固定为 "dynamic"，target 为查询字符串
 */
export interface IDynamicCustomList extends ICustomListBase {
    type: "dynamic";
    target: string;
}

/**
 * 静态列表（基于固定 ID 集合）
 * type 固定为 "static"，target 为块 ID 数组
 */
export interface IStaticCustomList extends ICustomListBase {
    type: "static";
    target: string[];
}

/**
 * 联合类型：动态列表 | 静态列表
 */
export type ICustomList = IDynamicCustomList | IStaticCustomList;

/**
 * SQL 查询返回的块数据结构（前端消费子集）
 */
export interface IBlock {
    id: string;
    content?: string;
    tag?: string;
    box?: string;
    type?: string;
    subType?: string;
    hPath?: string;
    ial?: { icon?: string };
}
