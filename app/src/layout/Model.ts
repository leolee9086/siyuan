import { Constants } from "../constants";
import { getModelHandlers } from "./modelRegistry";
/** 用途：识别 Electron 宿主；使用范围：原始 exit 帧接续登记；解耦评估：平台事实必须由统一网关提供，不能从消息参数推断。 */
import {isElectron} from "./imports";
/** 用途：读取接续停机门控；使用范围：Model WebSocket 错误与重连边界；解耦评估：跨模块状态必须复用唯一注册槽。 */
import {isForgeRuntimeElectronRestartActive} from "./imports";
/** 用途：登记原始 Electron exit 身份；使用范围：异步消息处理之前；解耦评估：调用唯一接续状态机，避免在 Model 内复制解析逻辑。 */
import {prepareForgeRuntimeElectronContinuity} from "./imports";
import type {ILayoutModel} from "./lifecycle/model.types";
import type {ILayoutModelHost} from "./lifecycle/model.types";
import type {IModelConnectOptions} from "./lifecycle/model.types";
import {createModelWebSocket} from "./modelWebSocket.factory";

/** 在消息进入异步队列前登记 Electron Forge exit 身份，避免 close/error 抢先显示普通内核故障。 */
const prepareElectronExitFrame = (serializedResponse: unknown) => {
    if (!isElectron || typeof serializedResponse !== "string") {
        return;
    }
    let response: unknown;
    try {
        response = JSON.parse(serializedResponse);
    } catch {
        return;
    }
    if (typeof response !== "object" || response === null || Reflect.get(response, "cmd") !== "exit") {
        return;
    }
    try {
        prepareForgeRuntimeElectronContinuity(Reflect.get(response, "data"));
    } catch (error) {
        // index.ts 负责向用户展示结构化载荷错误；这里仅保持 WebSocket 错误门控同步。
        console.error("[Forge Runtime] Electron exit identity preparation failed", error);
    }
};

/** 布局模型基类，统一管理 App 引用、WebSocket 传输及可停止的重连生命周期。 */
export class Model<
    TApplication extends object | undefined = object,
    TParent extends ILayoutModelHost = ILayoutModelHost,
> implements ILayoutModel {
    public readonly layoutModel = true as const;
    /** connect() 成功创建连接后存在；Inbox 等无连接模型始终保持未设置。 */
    public ws?: WebSocket;
    /** 首次 send() 时产生；构造完成不代表已经发送过内核命令。 */
    public reqId?: number;
    /** 模型挂载到 Tab 等宿主后由布局生命周期写入。 */
    public parent?: TParent;
    public app: TApplication;
    /** 主通道在应用就绪（isReady）前暂存的推送；由启动序列通过 flushMainMessages 统一回放。 */
    private mainMessageQueue: {
        data: unknown,
        callback: (data: IWebSocketData) => void | Promise<void>,
        socket: WebSocket,
    }[] = [];
    private reconnectTimer: number | null = null;
    private destroyed = false;
    private messageQueue: Promise<void> = Promise.resolve();

    constructor(options: {
        app: TApplication,
    }) {
        this.app = options.app;
    }

    /** 回放主通道在应用就绪前排队的推送；仅接受仍属于当前连接且未销毁的消息。 */
    public flushMainMessages() {
        const messages = this.mainMessageQueue.splice(0);
        messages.forEach((message) => {
            try {
                if (!this.destroyed && this.ws === message.socket) {
                    this.enqueueModelMessage(message.data, message.callback, message.socket);
                }
            } catch (error) {
                console.error("Failed to process queued WebSocket message:", error);
            }
        });
    }

    /** 将一条已通过门控的序列化消息放入实例消息队列；回放与实时消息共用同一分发顺序和陈旧性守卫。 */
    private enqueueModelMessage(serializedResponse: unknown, msgCallback: (data: IWebSocketData) => void | Promise<void>, socket: WebSocket) {
        // WebSocket 不会等待异步事件监听器；实例队列保持与原同步实现相同的消息分发顺序。
        this.messageQueue = this.messageQueue.then(async () => {
            if (this.destroyed || this.ws !== socket) {
                return;
            }
            if (typeof serializedResponse !== "string") {
                throw new TypeError("Model WebSocket message payload must be a JSON string");
            }
            const response: IWebSocketData = JSON.parse(serializedResponse);
            const data = await getModelHandlers().processMessage(response);
            // 处理期间可能发生重连或销毁；旧连接的迟到结果不得进入当前模型回调。
            if (this.destroyed || this.ws !== socket) {
                return;
            }
            if (data) {
                await msgCallback?.call(this, data);
            }
        }).catch((error: unknown) => {
            // 单条消息失败必须可观察，同时将队列恢复为 fulfilled，保证后续消息仍可处理。
            console.error("Model WebSocket message processing failed", error);
        });
    }

    /** 建立模型同步连接；重连时复用相同参数并替换旧连接。 */
    public connect(options: IModelConnectOptions) {
        this.destroyed = false;
        this.clearReconnectTimer();
        const websocketURL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
        const ws = createModelWebSocket(`${websocketURL}?app=${Constants.SIYUAN_APPID}&id=${options.id}${options.type ? "&type=" + options.type : ""}`);
        // 新连接拥有独立的消息序列；旧连接中未完成的处理不得阻塞新连接。
        this.messageQueue = Promise.resolve();
        ws.onopen = () => {
            if (this.destroyed || this.ws !== ws) {
                return;
            }
            if (options.callback) {
                try {
                    const callbackResult = options.callback.call(this);
                    if (callbackResult) {
                        void callbackResult.catch((error: unknown) => {
                            console.error("Model WebSocket open callback failed", error);
                        });
                    }
                } catch (error) {
                    console.error("Model WebSocket open callback failed", error);
                }
            }
            const logElement = document.getElementById("errorLog");
            if (logElement) {
                // 内核中断后无法 catch fetch 请求错误，重连会导致无法执行 transactionsTimeout
                getModelHandlers().reloadSync({ upsertRootIDs: [], removeRootIDs: [] });
                window.siyuan.dialogs.find(item => {
                    // 只关闭内核错误提示 Dialog，避免触碰其它正在显示的宿主窗口。
                    if (item.element.id === "errorLog") {
                        item.destroy();
                        return true;
                    }
                });
            }
        };
        ws.onmessage = (event) => {
            const serializedResponse = event.data;
            // exit 身份登记必须先于 msgCallback/isReady/config 门控；内核可能在配置加载完成前就关闭连接。
            prepareElectronExitFrame(serializedResponse);
            if (!options.msgCallback) {
                return;
            }
            // 主通道在应用就绪（isReady）前到达的推送先入队，待启动序列调用 flushMainMessages 统一回放。
            if (options.type === "main" && !window.siyuan.isReady) {
                this.mainMessageQueue.push({
                    data: serializedResponse,
                    callback: options.msgCallback,
                    socket: ws,
                });
                return;
            }
            // 非主通道在界面初始化后才创建；等待 config 加载完成才接受推送 https://github.com/siyuan-note/siyuan/issues/17508
            if (!window.siyuan.config) {
                return;
            }
            this.enqueueModelMessage(serializedResponse, options.msgCallback, ws);
        };
        ws.onclose = (ev) => this.handleSocketClose(ws, ev, options);
        ws.onerror = () => {
            // 仅主连接（type=main）且 WebSocket 已关闭（readyState=3）时显示内核错误提示
            if (!this.destroyed && !isForgeRuntimeElectronRestartActive() && this.ws === ws &&
                ws.url.endsWith("&type=main") && ws.readyState === WebSocket.CLOSED) {
                getModelHandlers().kernelError();
            }
        };
        const previousSocket = this.ws;
        this.ws = ws;
        if (previousSocket && previousSocket !== ws) {
            previousSocket.onopen = null;
            previousSocket.onmessage = null;
            previousSocket.onclose = null;
            previousSocket.onerror = null;
            if (previousSocket.readyState !== WebSocket.CLOSED) {
                previousSocket.close();
            }
        }
    }

    /** 向模型 WebSocket 发送内核命令；Inbox 等无连接模型会直接忽略请求。 */
    public send(cmd: string, param: Record<string, unknown>, process = false) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) { // Inbox 无 ws；连接建立前不能调用 send
            return;
        }
        this.reqId = process ? 0 : Date.now();
        this.ws.send(JSON.stringify({
            cmd,
            reqId: this.reqId,
            param,
            // pushMode
            // 0: 所有应用所有会话广播
            // 1：自我应用会话单播
            // 2：非自我会话广播
            // 4：非自我应用所有会话广播
            // 5：单个应用内所有会话广播
            // 6：非自我应用主会话广播
        }));
    }

    /** 处理连接关闭并按原有规则安排重连；销毁中的模型不会再次建立连接。 */
    private handleSocketClose(socket: WebSocket, ev: CloseEvent, options: IModelConnectOptions) {
        if (this.destroyed || this.ws !== socket || 0 <= ev.reason.indexOf("unauthenticated") ||
            0 <= ev.reason.indexOf("close websocket")) {
            return;
        }
        if (!isForgeRuntimeElectronRestartActive()) {
            console.warn("WebSocket is closed. Reconnect will be attempted in 3 second.", ev);
        }
        // 内核要求短暂退避后重连，且现有协议没有可等待的 ready 信号；该延迟与原实现保持一致。
        this.scheduleReconnect(options);
    }

    /** 安排一次可被 Electron 热替换状态再次门控的模型重连。 */
    private scheduleReconnect(options: IModelConnectOptions) {
        this.clearReconnectTimer();
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            if (isForgeRuntimeElectronRestartActive()) {
                this.scheduleReconnect(options);
                return;
            }
            this.reconnect(options);
        }, 3000);
    }

    /** 在定时器触发时确认模型仍然存活，然后恢复原有连接参数。 */
    private reconnect(options: IModelConnectOptions) {
        if (this.destroyed) {
            return;
        }
        this.connect(options);
    }

    /** 清理尚未执行的重连定时器，供重新连接和销毁路径共享。 */
    private clearReconnectTimer() {
        // 重连前或销毁时清理旧定时器，避免同一模型同时排队多个连接。
        if (this.reconnectTimer !== null) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /** 通知内核关闭模型连接并释放本地 socket；可在 CONNECTING/CLOSING 阶段安全调用。 */
    public dispose() {
        // 只有已建立连接时 closews 才能发送；连接中的 socket 直接在本地关闭。
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send("closews", {});
        }
        this.disposeConnection();
    }

    /** 关闭网络连接并禁止自动重连；具体模型的公开销毁方法可调用此保护边界。 */
    protected disposeConnection() {
        this.destroyed = true;
        this.clearReconnectTimer();
        const socket = this.ws;
        delete this.ws;
        this.messageQueue = Promise.resolve();
        if (!socket) {
            return;
        }
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        // 已关闭的 socket 无需重复 close，其余状态均终止以防销毁后继续连接。
        if (socket.readyState !== WebSocket.CLOSED) {
            socket.close();
        }
    }
}
