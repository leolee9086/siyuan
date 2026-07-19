import { Constants } from "../constants";
import { getModelHandlers } from "./Model.registry";
import type { Tab } from "./Tab";
import type { App } from "../index";
import type {ILayoutModel} from "./lifecycle/model.types";

/** Model WebSocket 连接参数；由具体 Dock 保存稳定 ID 和消息处理器，用于首次连接与重连。 */
interface IConnectOptions {
    id: string,
    type?: TWS,
    callback?: () => void,
    msgCallback?: (data: IWebSocketData) => void
}

/** 布局模型基类，统一管理 App 引用、WebSocket 传输及可停止的重连生命周期。 */
export class Model implements ILayoutModel {
    public readonly layoutModel = true as const;
    public ws: WebSocket;
    public reqId: number;
    public parent: Tab;
    public app: App;
    private reconnectTimer: number | null = null;
    private destroyed = false;

    constructor(options: {
        app: App,
    }) {
        this.app = options.app;
    }

    /** 建立模型同步连接；重连时复用相同参数并替换旧连接。 */
    public connect(options: IConnectOptions) {
        this.destroyed = false;
        this.clearReconnectTimer();
        const websocketURL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
        const ws = new WebSocket(`${websocketURL}?app=${Constants.SIYUAN_APPID}&id=${options.id}${options.type ? "&type=" + options.type : ""}`);
        ws.onopen = () => {
            if (options.callback) {
                options.callback.call(this);
            }
            const logElement = document.getElementById("errorLog");
            if (logElement) {
                // 内核中断后无法 catch fetch 请求错误，重连会导致无法执行 transactionsTimeout
                getModelHandlers().reloadSync(this.app, { upsertRootIDs: [], removeRootIDs: [] });
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
            // 等待 config 加载完成才接受推送 https://github.com/siyuan-note/siyuan/issues/17508
            if (!options.msgCallback || !window.siyuan.config) {
                return;
            }
            const data = getModelHandlers().processMessage(JSON.parse(event.data));
            if (data) {
                options.msgCallback.call(this, data);
            }
        };
        ws.onclose = (ev) => this.handleSocketClose(ev, options);
        ws.onerror = (err: Event & { target: { url: string, readyState: number } }) => {
            // 仅主连接（type=main）且 WebSocket 已关闭（readyState=3）时显示内核错误提示
            if (err.target.url.endsWith("&type=main") && err.target.readyState === 3) {
                getModelHandlers().kernelError();
            }
        };
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
        }
        this.ws = ws;
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
    private handleSocketClose(ev: CloseEvent, options: IConnectOptions) {
        if (this.destroyed || 0 <= ev.reason.indexOf("unauthenticated") ||
            0 <= ev.reason.indexOf("close websocket")) {
            return;
        }
        console.warn("WebSocket is closed. Reconnect will be attempted in 3 second.", ev);
        // 内核要求短暂退避后重连，且现有协议没有可等待的 ready 信号；该延迟与原实现保持一致。
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnect(options);
        }, 3000);
    }

    /** 在定时器触发时确认模型仍然存活，然后恢复原有连接参数。 */
    private reconnect(options: IConnectOptions) {
        if (this.destroyed) {
            return;
        }
        this.connect({id: options.id, type: options.type, msgCallback: options.msgCallback});
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
