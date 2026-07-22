/**
 * 用途：让分页参数明确接收一个不可变的 armor 身份快照。
 * 使用范围：仅用于 `FetchHistoryPageOptions.session` 的编译期约束。
 * 解耦评估：类型导入避免复制身份结构，不引入运行时依赖或全局身份读取。
 */
import type {MagiArmorSession} from "../service/magiIdentitySession";

/**
 * 用途：表示内置 MAGI 渠道投影给聊天界面的一条只读历史消息。
 * 使用场景：校验服务端历史页并合并为连续时间线。
 * 关联类型：由 `MagiMainUIConversationHistory` 聚合，不暴露渠道存储内部字段。
 * 问题/改进：后续投递状态落地后可增加 accepted/completed 状态字段。
 */
export interface MagiMainUIHistoryMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
}

/**
 * 用途：承载一个已验证身份对应的唯一 MAGI 主界面会话及其完整消息时间线。
 * 使用场景：Agent Panel 在挂载、目标切换和身份切换后重建消息视图。
 * 关联类型：消息来自 `MagiMainUIHistoryMessage`，身份输入来自 `MagiArmorSession`。
 * 问题/改进：实时跨宿主同步落地后可附加服务端序列游标。
 */
export interface MagiMainUIConversationHistory {
    conversationId: string;
    messages: MagiMainUIHistoryMessage[];
}

/**
 * 用途：抽象浏览器 fetch 的最小调用契约。
 * 使用场景：生产环境使用全局 fetch，单元测试注入确定性的响应序列。
 * 关联类型：签名与平台 `fetch` 对齐。
 * 问题/改进：不承载认证或重试策略。
 */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * 用途：集中描述单页历史请求的身份、游标、取消信号和传输实现。
 * 使用场景：分页加载器每轮调用内部 `fetchHistoryPage`。
 * 关联类型：身份使用 `MagiArmorSession`，传输使用 `FetchLike`。
 * 问题/改进：仅供服务实现使用，不属于面板宿主 Port。
 */
export interface FetchHistoryPageOptions {
    session: MagiArmorSession;
    before: number;
    signal?: AbortSignal;
    fetchImpl: FetchLike;
}
