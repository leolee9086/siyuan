/** 数据库条目定位请求；由调用方声明目标身份、视觉反馈和视图持久化策略。 */
export interface IAVLocateRequest {
    itemID: string;
    groupID?: string;
    viewID?: string;
    select?: boolean;
    highlight?: boolean;
    persistView?: boolean;
    previousViewID?: string;
    messageShown?: boolean;
}
