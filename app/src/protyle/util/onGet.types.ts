/** 编辑器内核响应处理的最小请求契约。 */
export interface IOnGetRequest {
    data: IWebSocketData;
    protyle: IProtyle;
    action?: TProtyleAction[];
}

/** 编辑器内核响应处理能力。 */
export type TOnGet = (options: IOnGetRequest) => void;
