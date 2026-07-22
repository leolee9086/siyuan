/**
 * 用途：约束公开加载入口接收的已验证 armor 会话快照。
 * 使用范围：仅用于参数类型，不在服务内读取全局身份状态。
 * 解耦评估：类型依赖用于保持身份契约一致；运行时身份已由调用方参数注入，无需事件或全局访问。
 */
import type {MagiArmorSession} from "../service/magiIdentitySession";
/**
 * 用途：约束内部单页请求的参数对象。
 * 使用范围：仅由 `fetchHistoryPage` 消费。
 * 解耦评估：参数类型是服务内部边界，运行时依赖仍由参数传入。
 */
import type {FetchHistoryPageOptions} from "./magiMainUIConversation.types";
/**
 * 用途：约束测试可注入的 fetch 最小签名。
 * 使用范围：公开加载入口的 `fetchImpl` 可选参数。
 * 解耦评估：该类型正用于传输依赖注入，不应替换为全局硬依赖。
 */
import type {FetchLike} from "./magiMainUIConversation.types";
/**
 * 用途：约束解析后和去重阶段的渠道消息结构。
 * 使用范围：只用于分页合并内部实现。
 * 解耦评估：协议投影类型不包含宿主行为，直接类型依赖最清晰。
 */
import type {MagiMainUIHistoryMessage} from "./magiMainUIConversation.types";

// 公开最终会话投影类型，调用方不需要依赖内部分页类型文件。
export type {MagiMainUIConversationHistory} from "./magiMainUIConversation.types";

const HISTORY_ENDPOINT = "/api/s-forge/magi/v1/main-ui/history";
const HISTORY_PAGE_SIZE = 200;

/**
 * 作用：在网络边界逐字段校验 MAGI 历史页。
 * 意图：畸形、缺字段或角色非法的数据必须成为可见错误，禁止混入其它身份时间线。
 * 调用时机：每个历史请求成功解析 JSON 后。
 * 问题/改进：新增协议字段时应先扩展这里的守卫与契约测试。
 */
function parseHistoryPage(value: unknown) {
    // 顶层对象是读取任何协议字段的前提，数组和空值均属于协议错误。
    if (!value || typeof value !== "object") {
        throw new Error("MAGI history response is not an object");
    }
    const conversationId = String(Reflect.get(value, "conversationId") ?? "").trim();
    const rawMessages = Reflect.get(value, "messages");
    const hasMore = Reflect.get(value, "hasMore") === true;
    const oldestAt = Number(Reflect.get(value, "oldestAt") ?? 0);
    // 会话标识和消息数组共同构成可用于隔离身份的最小响应。
    if (!conversationId || !Array.isArray(rawMessages)) {
        throw new Error("MAGI history response is missing conversation data");
    }
    const messages = rawMessages.map(parseHistoryMessage);
    return {conversationId, messages, hasMore, oldestAt};
}

/**
 * 作用：校验并投影服务端返回的单条渠道消息。
 * 意图：角色、标识和时间戳异常时立即终止整页加载，避免部分历史污染视图。
 * 调用时机：`parseHistoryPage` 遍历消息数组时。
 * 问题/改进：富媒体消息接入后应扩展为按 contentType 分派的独立投影器。
 */
function parseHistoryMessage(raw: unknown) {
    // 单条消息也必须保持对象结构，避免字符串等宽松输入被隐式转换。
    if (!raw || typeof raw !== "object") {
        throw new Error("MAGI history contains an invalid message");
    }
    const id = String(Reflect.get(raw, "id") ?? "").trim();
    const role = String(Reflect.get(raw, "role") ?? "").trim();
    const content = String(Reflect.get(raw, "content") ?? "");
    const createdAt = Number(Reflect.get(raw, "createdAt") ?? 0);
    // 只接受聊天面板能无歧义投影的角色和稳定消息标识。
    if (!id || (role !== "user" && role !== "assistant") || !Number.isFinite(createdAt)) {
        throw new Error("MAGI history contains an invalid message shape");
    }
    return {id, role, content, createdAt};
}

/**
 * 作用：从分页结果中提取尚未加入时间线的消息。
 * 意图：跨页边界出现重复消息时保持界面幂等，同时不改变服务端顺序。
 * 调用时机：每一页通过 conversation 一致性检查之后。
 * 问题/改进：服务端序列号落地后应同时校验相邻消息序列连续性。
 */
function takeUniqueMessages(messages: MagiMainUIHistoryMessage[], messageIds: Set<string>) {
    const uniqueMessages: MagiMainUIHistoryMessage[] = [];
    for (const message of messages) {
        // 已处理过的稳定消息 id 表示分页边界重复，不再追加第二份。
        if (messageIds.has(message.id)) {
            continue;
        }
        messageIds.add(message.id);
        uniqueMessages.push(message);
    }
    return uniqueMessages;
}

/**
 * 作用：使用身份快照读取一页内置 MAGI 渠道历史。
 * 意图：认证头、请求体和错误解析只保留一份确定实现。
 * 调用时机：完整历史加载器按服务端 oldestAt 游标依次调用。
 * 问题/改进：实时同步不应复用此全量分页函数。
 */
async function fetchHistoryPage(options: FetchHistoryPageOptions) {
    const response = await options.fetchImpl(HISTORY_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.session.armorToken}`,
        },
        body: JSON.stringify({before: options.before, limit: HISTORY_PAGE_SIZE}),
        signal: options.signal,
    });
    // 非成功状态会优先呈现服务端明确错误，保证身份和存储故障可观察。
    if (!response.ok) {
        let detail = "";
        try {
            const payload: unknown = await response.json();
            // JSON 错误对象存在时读取公开 error 字段，其他形状使用 HTTP 状态说明。
            if (payload && typeof payload === "object") {
                detail = String(Reflect.get(payload, "error") ?? "").trim();
            }
        } catch {
            detail = "";
        }
        throw new Error(detail || `MAGI history request failed with HTTP ${response.status}`);
    }
    return parseHistoryPage(await response.json());
}

/**
 * 作用：读取当前 Guardian 身份的唯一 MAGI 主界面渠道记录并合并全部分页。
 * 意图：让所有 Agent Panel 宿主共享服务端权威时间线，且不依赖普通 Agent SessionStore。
 * 调用时机：面板首次进入 MAGI、切回 MAGI或身份会话发生变化时。
 * 问题/改进：后续增加增量序列接口后，初次全量读取可转为最近窗口加按需加载。
 */
export async function loadMagiMainUIConversation(options: {
    session: MagiArmorSession;
    signal?: AbortSignal;
    fetchImpl?: FetchLike;
}) {
    const {session, signal, fetchImpl = window.fetch.bind(window)} = options;
    // 只有主界面 Guardian armor 具备这条身份级时间线，工具渠道不得借用。
    if (session.routeClass !== "guardian" || session.channel !== "magi-main-ui" || !session.identityId) {
        throw new Error("A verified MAGI main UI identity is required");
    }

    let before = 0;
    let conversationId = "";
    let messages: MagiMainUIHistoryMessage[] = [];
    const messageIds = new Set<string>();
    while (true) {
        const page = await fetchHistoryPage({session, before, signal, fetchImpl});
        // 分页过程中 conversation 变化意味着身份或服务端归属发生变化，必须整体终止。
        if (conversationId && page.conversationId !== conversationId) {
            throw new Error("MAGI history conversation changed during pagination");
        }
        conversationId = page.conversationId;
        const uniquePage = takeUniqueMessages(page.messages, messageIds);
        messages = [...uniquePage, ...messages];
        // 服务端明确无更早记录时才交付完整时间线。
        if (!page.hasMore) {
            return {conversationId, messages};
        }
        // 游标停滞会造成无限请求，同时说明服务端顺序契约已被破坏。
        if (!page.oldestAt || page.oldestAt === before) {
            throw new Error("MAGI history pagination did not advance");
        }
        before = page.oldestAt;
    }
}
