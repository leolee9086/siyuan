/** 表示会话切换、删除和重命名的业务回调，由 AgentChat 提供给面板。 */
export interface AgentSessionPanelCallbacks {
    onSwitch: (id: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onRename: (id: string, title: string) => Promise<void>;
}

/** 表示会话面板的宿主节点、当前状态读取器和业务回调。 */
export interface AgentSessionPanelOptions {
    triggerBtn: HTMLElement;
    host: HTMLElement;
    getCurrentSessionId: () => string;
    getDefaultTitle: () => string;
    callbacks: AgentSessionPanelCallbacks;
}

/** 表示会话弹层创建后的三个稳定 DOM 节点，供挂载和事件绑定共享。 */
export interface AgentSessionPopupElements {
    popup: HTMLElement;
    itemsContainer: HTMLElement;
    searchInput: HTMLInputElement;
}

/** 表示重命名编辑结束时的值和 DOM 节点，供状态层还原标题元素。 */
export interface AgentSessionRenameResult {
    newTitle: string;
    input: HTMLInputElement;
    titleElement: HTMLElement;
}

/** 表示弹层级交互回调，将搜索、分页和关闭交回状态所有者。 */
export interface AgentSessionPopupHandlers {
    onSearch: (keyword: string, container: HTMLElement) => void;
    onLoadMore: (container: HTMLElement) => void;
    onClose: () => void;
}

/** 表示会话行的动作回调，列表视图不直接调用业务 API。 */
export interface AgentSessionListHandlers {
    getCurrentSessionId: () => string;
    onMore: (anchor: HTMLElement, id: string) => void;
    onRename: (id: string, row: HTMLElement) => void;
    onSwitch: (id: string) => void;
}

/** 表示一次列表渲染的当前项、缺省标题和追加模式。 */
export interface AgentSessionRenderOptions {
    currentId: string;
    defaultTitle: string;
    append: boolean;
}

/** 表示控制器一次列表渲染的容器、会话页和追加语义。 */
export interface AgentSessionPageRender {
    container: HTMLElement;
    listItems: SessionIndexItem[];
    append: boolean;
}

/** 表示一次目录绑定请求，主目录与附加目录共用同一输入。 */
export interface AgentSessionDirectoryBindInput {
    id: string;
    main: boolean;
    permission: string;
}

/** 表示会话面板可变状态，仅由函数式控制器持有和更新。 */
export interface AgentSessionPanelState {
    options: AgentSessionPanelOptions;
    popup: HTMLElement | null;
    isRendering: boolean;
    items: SessionIndexItem[];
    total: number;
    page: number;
    isLoadingMore: boolean;
    searchTimer: number | null;
    searchKeyword: string;
}

/** 表示会话面板对 AgentChat 暴露的四个生命周期操作。 */
export interface AgentSessionPanelController {
    toggle: () => void;
    close: () => void;
    destroy: () => void;
    refresh: () => Promise<void>;
}
/** 表示 Web/移动端任务目录路径对话框的局部状态。 */
export interface AgentTaskDirectoryPathDialogState {
    dialog: Dialog | null;
    input: HTMLInputElement | null;
    resolve: (path: string) => void;
    settled: boolean;
}
/** 用途：约束面板状态中的会话摘要；使用范围：控制器分页状态；解耦评估：纯类型依赖。 */
import type {SessionIndexItem} from "../SessionStore.types";
/** 用途：约束路径输入框持有的统一对话框；使用范围：局部状态类型；解耦评估：仅类型依赖，不引入运行时环。 */
import type {Dialog} from "./imports";
