/**
 * 最近文档数据类型
 */
export interface IRecentDoc {
    rootID: string;
    icon: string;
    title: string;
    viewedAt?: number;
    closedAt?: number;
    openAt?: number;
}
