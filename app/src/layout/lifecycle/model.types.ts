/** 布局模型宿主所属的可测量容器形状。 */
export interface ILayoutModelContainer {
    readonly element: HTMLElement;
}

/** 布局模型挂载宿主的最小形状。 */
export interface ILayoutModelHost {
    readonly parent?: ILayoutModelContainer;
}

/** 布局系统接纳的最小模型契约，不包含网络、应用实例或资源生命周期能力。 */
export interface ILayoutModel {
    readonly layoutModel: true;
    parent?: ILayoutModelHost;
}

/** 能够直接提供自身布局序列化结果的模型能力。 */
export interface ILayoutSerializableModel extends ILayoutModel {
    readonly layoutSerialization: Readonly<Record<string, unknown>>;
}

/** 具有公开资源释放能力的布局模型。 */
export interface ILayoutDisposableModel extends ILayoutModel {
    dispose: () => void;
}

/** 具有业务资源销毁钩子的布局模型。 */
export interface ILayoutDestroyableModel extends ILayoutModel {
    destroy: () => void;
}

/** Model WebSocket 连接参数；具体模型以稳定 ID 和回调恢复同一连接语义。 */
export interface IModelConnectOptions {
    id: string;
    type?: TWS;
    callback?: () => void;
    msgCallback?: (data: IWebSocketData) => void;
}

/** Model class 的完整公共领域表面；具体模型可在此基础上增加自身状态和行为。 */
export interface ModelDomain<
    TApplication extends object = object,
    TParent extends ILayoutModelHost = ILayoutModelHost,
> extends ILayoutModel {
    readonly layoutModel: true;
    ws: WebSocket;
    reqId: number;
    parent: TParent;
    app: TApplication;
    connect(options: IModelConnectOptions): void;
    send(cmd: string, param: Record<string, unknown>, process?: boolean): void;
    dispose(): void;
}
