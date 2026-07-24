/** Model WebSocket 回调所需的应用层能力集合。 */
export interface IModelHandlers {
    processMessage: (response: IWebSocketData) => IWebSocketData | false;
    kernelError: () => void;
    /** 宿主在注册时绑定应用实例，Model 只传递同步变更数据。 */
    reloadSync: (data: { upsertRootIDs: string[], removeRootIDs: string[] }) => void;
}
