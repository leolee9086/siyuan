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
    ial?: { [key: string]: string };
    icon?: string;
}

export interface IForwardlinkStatusItem {
    sort: number;
    scrollTop: number;
    forwardlinkOpenIds: string[];
}

export interface IForwardlinkStatus {
    [key: string]: IForwardlinkStatusItem;
}
