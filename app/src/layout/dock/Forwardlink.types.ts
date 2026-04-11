/**
 * 正向链接树节点数据
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
}

