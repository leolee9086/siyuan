import { fetchSyncPost } from "../../util/network/fetch";
import type { MagiMessage } from "../utils/messageFactory.types";
import type { ConnectionStatus, MagiSessionExportMode, MagiSessionExportPersonaReloadEvent, MagiSessionExportRecord, MagiSessionExportRound, WrappedSeel } from "./useMagi.types";

const EXPORT_SCHEMA_VERSION = "MAGI-SESSION-EXPORT-v1";
const EXPORT_BASE_DIR = "/data/private/magi_exports";
const REDACTED = "[REDACTED]";
const REDACTED_PATH = "[REDACTED_PATH]";
const REDACTED_TOKEN = "[REDACTED_TOKEN]";

const SENSITIVE_KEY_PATTERN = /(token|secret|password|api.?key|authorization|cookie)/i;
const FILE_PATH_PATTERN = /\/data\/[^\s;，。]+/g;
const TOKEN_PATTERN = /\b(sk-[A-Za-z0-9_-]{10,})\b/g;

/** @同步豁免: 纯格式化函数，无异步依赖 */
function buildTimestampTag(date: Date): string {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const sec = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}_${hh}${min}${sec}`;
}

/** @同步豁免: 纯字符串处理，无异步依赖 */
function sanitizeText(value: string, mode: MagiSessionExportMode): string {
    // 原始模式下保留内容，不做脱敏。
    if (mode === "raw") {
        return value;
    }
    const withoutPath = value.replace(FILE_PATH_PATTERN, REDACTED_PATH);
    return withoutPath.replace(TOKEN_PATTERN, REDACTED_TOKEN);
}

/** @同步豁免: 纯对象遍历，无异步依赖 */
function sanitizeUnknown(value: unknown, mode: MagiSessionExportMode): unknown {
    // 原始模式下直接返回原值。
    if (mode === "raw") {
        return value;
    }
    // 字符串值按文本规则脱敏。
    if (typeof value === "string") {
        return sanitizeText(value, mode);
    }
    // 数组逐项递归脱敏。
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeUnknown(item, mode));
    }
    // 原始类型或空对象直接透传。
    if (!value || typeof value !== "object") {
        return value;
    }
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        // 命中敏感键名时直接掩码，避免泄露凭据。
        if (SENSITIVE_KEY_PATTERN.test(key)) {
            next[key] = REDACTED;
            continue;
        }
        next[key] = sanitizeUnknown(item, mode);
    }
    return next;
}

/** @同步豁免: 纯对象处理，无异步依赖 */
function sanitizeMeta(meta: Record<string, unknown>, mode: MagiSessionExportMode): Record<string, unknown> {
    const sanitized = sanitizeUnknown(meta, mode);
    // 非对象结果回退为空，避免污染导出结构。
    if (!sanitized || typeof sanitized !== "object") {
        return {};
    }
    return Object.fromEntries(Object.entries(sanitized));
}

/** @同步豁免: 纯对象复制，无异步依赖 */
function cloneMessage(message: MagiMessage, mode: MagiSessionExportMode): MagiMessage {
    const cloned: MagiMessage = {
        ...message,
        content: sanitizeText(message.content, mode),
    };
    // 有 meta 时同步执行深度脱敏。
    if (message.meta) {
        cloned.meta = sanitizeMeta(message.meta, mode);
    }
    return cloned;
}

/** @同步豁免: 纯反射读取，无异步依赖 */
function getMetaValue(meta: Record<string, unknown> | undefined, key: string): unknown {
    return meta ? Reflect.get(meta, key) : undefined;
}

/** @同步豁免: 纯数组构造，无异步依赖 */
function parseVoteDetails(rawDetails: unknown): Array<{ name: string; decision: string }> {
    // 非数组输入不可构成有效投票明细。
    if (!Array.isArray(rawDetails)) {
        return [];
    }
    const result: Array<{ name: string; decision: string }> = [];
    for (const item of rawDetails) {
        // 仅对象条目允许继续解析。
        if (!item || typeof item !== "object") {
            continue;
        }
        const name = Reflect.get(item, "name");
        const decision = Reflect.get(item, "decision");
        // name/decision 缺失或类型不符时跳过该条目。
        if (typeof name !== "string" || typeof decision !== "string") {
            continue;
        }
        result.push({ name, decision });
    }
    return result;
}

/** @同步豁免: 纯字符串查找，无异步依赖 */
function parseProfilePathFromText(content: string): string | undefined {
    const marker = content.indexOf(":");
    // 未找到分隔符时视为不可提取路径。
    if (marker < 0) {
        return undefined;
    }
    const value = content.slice(marker + 1).trim();
    return value || undefined;
}

/** @同步豁免: 纯遍历聚合，无异步依赖 */
function collectPersonaReloadEvents(timeline: MagiMessage[]): MagiSessionExportPersonaReloadEvent[] {
    const events: MagiSessionExportPersonaReloadEvent[] = [];
    for (const message of timeline) {
        const content = message.content;
        // 匹配人格重载成功事件，记录加载路径用于审计。
        if (content.includes("已加载人格档案并完成重建")) {
            events.push({
                status: "loaded",
                profilePath: parseProfilePathFromText(content),
                message: content,
                timestamp: message.timestamp,
            });
            continue;
        }
        // 匹配档案读取失败事件，记录失败内容用于排障。
        if (content.includes("人格档案读取失败")) {
            events.push({
                status: "failed_load",
                profilePath: parseProfilePathFromText(content),
                message: content,
                timestamp: message.timestamp,
            });
            continue;
        }
        // 匹配重载失败事件，标记重建链路异常。
        if (content.includes("人格重载失败")) {
            events.push({
                status: "failed_reload",
                message: content,
                timestamp: message.timestamp,
            });
            continue;
        }
        // 匹配兼容分支事件（缺少 profilePath 导致跳过重载）。
        if (content.includes("未提供人格档案路径")) {
            events.push({
                status: "skipped",
                message: content,
                timestamp: message.timestamp,
            });
        }
    }
    return events;
}

/** @同步豁免: 纯对象构造，无异步依赖 */
function createRound(roundIndex: number, message: MagiMessage): MagiSessionExportRound {
    return {
        roundId: `round-${roundIndex}`,
        startedAt: message.timestamp,
        endedAt: message.timestamp,
        durationMs: 0,
        userInput: message.content,
        sageResponses: [],
        voteStatuses: [],
        finalConsensus: null,
        errors: [],
        messages: [message],
    };
}

/** @同步豁免: 纯聚合收口，无异步依赖 */
function finalizeRound(
    currentRound: MagiSessionExportRound | null,
    rounds: MagiSessionExportRound[],
): MagiSessionExportRound | null {
    // 没有活跃轮次时无需收口。
    if (!currentRound) {
        return null;
    }
    const lastIndex = currentRound.messages.length - 1;
    const lastMessage = lastIndex >= 0 ? currentRound.messages[lastIndex] : null;
    const lastTimestamp = lastMessage ? lastMessage.timestamp : currentRound.startedAt;
    currentRound.endedAt = lastTimestamp;
    currentRound.durationMs = Math.max(0, currentRound.endedAt - currentRound.startedAt);
    rounds.push(currentRound);
    return null;
}

/** @同步豁免: 纯字段写入，无异步依赖 */
function collectRoundSageResponse(currentRound: MagiSessionExportRound, message: MagiMessage): void {
    const metaType = getMetaValue(message.meta, "type");
    // 仅处理显式标注的贤者响应节点。
    if (metaType !== "sage-response") {
        return;
    }
    const seel = getMetaValue(message.meta, "seel");
    const displayName = getMetaValue(message.meta, "displayName");
    const requiresDeliberation = getMetaValue(message.meta, "requiresDeliberation");
    // 标识字段不完整时跳过，避免污染导出结构。
    if (typeof seel !== "string" || typeof displayName !== "string") {
        return;
    }
    currentRound.sageResponses.push({
        seel,
        displayName,
        content: message.content,
        ...(typeof requiresDeliberation === "boolean" ? { requiresDeliberation } : {}),
        timestamp: message.timestamp,
    });
}

/** @同步豁免: 纯字段写入，无异步依赖 */
function collectRoundVoteStatus(currentRound: MagiSessionExportRound, message: MagiMessage): void {
    const metaType = getMetaValue(message.meta, "type");
    // 仅处理显式标注的投票状态节点。
    if (metaType !== "vote-status") {
        return;
    }
    const progress = getMetaValue(message.meta, "progress");
    const details = parseVoteDetails(getMetaValue(message.meta, "details"));
    const proposedAction = getMetaValue(message.meta, "proposedAction");
    currentRound.voteStatuses.push({
        progress: typeof progress === "number" ? progress : 0,
        details,
        ...(typeof proposedAction === "string" ? { proposedAction } : {}),
        timestamp: message.timestamp,
    });
}

/** @同步豁免: 纯聚合算法，无异步依赖 */
function buildRounds(timeline: MagiMessage[]): MagiSessionExportRound[] {
    const rounds: MagiSessionExportRound[] = [];
    let currentRound: MagiSessionExportRound | null = null;
    let roundIndex = 0;
    for (const message of timeline) {
        // user 消息视为一轮输入起点，先收口上一轮再开启新轮次。
        if (message.type === "user") {
            currentRound = finalizeRound(currentRound, rounds);
            roundIndex += 1;
            currentRound = createRound(roundIndex, message);
            continue;
        }
        // 未进入任何轮次前出现的系统消息不纳入 round。
        if (!currentRound) {
            continue;
        }
        currentRound.messages.push(message);
        // error 类型消息作为当前轮次异常记录。
        if (message.type === "error") {
            currentRound.errors.push(message);
        }
        collectRoundSageResponse(currentRound, message);
        collectRoundVoteStatus(currentRound, message);
        const consensusMode = getMetaValue(message.meta, "mode");
        // 仅记录最终共识节点（需要包含 mode 元信息）。
        if (message.type === "consensus" && typeof consensusMode === "string") {
            currentRound.finalConsensus = message;
        }
    }
    finalizeRound(currentRound, rounds);
    return rounds;
}

/** @同步豁免: 纯字符串拼装，无异步依赖 */
function buildSessionId(timeline: MagiMessage[]): string {
    const firstMessage = timeline[0];
    const firstTimestamp = firstMessage ? firstMessage.timestamp : Date.now();
    return `magi-session-${firstTimestamp}`;
}

/** 确保导出目录存在 */
async function ensureExportDir(): Promise<void> {
    const formData = new FormData();
    formData.append("path", EXPORT_BASE_DIR);
    formData.append("isDir", "true");
    formData.append("modTime", Date.now().toString());
    formData.append("file", "");
    await fetchSyncPost("/api/file/putFile", formData);
}

/** 写入 JSON 文件 */
async function writeExportFile(filePath: string, payload: unknown): Promise<void> {
    const fileName = filePath.split("/").pop() || "magi_session_export.json";
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const file = new File([blob], fileName, { lastModified: Date.now() });
    const formData = new FormData();
    formData.append("path", filePath);
    formData.append("isDir", "false");
    formData.append("modTime", Date.now().toString());
    formData.append("file", file);
    await fetchSyncPost("/api/file/putFile", formData);
}

/** 导出 MAGI 会话详细记录（含决策链路）。 */
export async function exportMagiSessionRecord(params: {
    seels: WrappedSeel[];
    consensusMessages: MagiMessage[];
    connectionStatus: ConnectionStatus;
    mode?: MagiSessionExportMode;
}): Promise<{ filePath: string; record: MagiSessionExportRecord }> {
    const mode = params.mode ?? "sanitized";
    const sortedTimeline = [...params.consensusMessages]
        .sort((left, right) => left.timestamp - right.timestamp)
        .map((message) => cloneMessage(message, mode));
    const rounds = buildRounds(sortedTimeline);
    const sessionId = buildSessionId(sortedTimeline);
    const now = new Date();
    const timestampTag = buildTimestampTag(now);
    const filePath = `${EXPORT_BASE_DIR}/${sessionId}_${timestampTag}.json`;
    const record: MagiSessionExportRecord = {
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: now.toISOString(),
        mode,
        sessionId,
        summary: {
            totalMessages: sortedTimeline.length,
            totalRounds: rounds.length,
            totalErrors: sortedTimeline.filter((message) => message.type === "error").length,
            connectionStatus: params.connectionStatus,
        },
        rounds,
        personaReloadEvents: collectPersonaReloadEvents(sortedTimeline),
        timeline: sortedTimeline,
        seelLogs: params.seels.map((seel) => ({
            seelName: seel.config.name,
            displayName: seel.config.displayName,
            messages: seel.messages.map((message) => cloneMessage(message, mode)),
        })),
    };
    await ensureExportDir();
    await writeExportFile(filePath, record);
    return { filePath, record };
}
