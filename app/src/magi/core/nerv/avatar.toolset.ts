import type { ReplyOptions } from "../core.types";

export const AVATAR_REPORT_TOOL_NAME = "report_to_core";

export type AvatarReportType = "heartbeat" | "progress" | "risk" | "summary";
export type AvatarReportUrgency = "low" | "medium" | "high";

export interface AvatarMetaReportPayload {
    type: AvatarReportType;
    content: string;
    urgency: AvatarReportUrgency;
}

export const AVATAR_META_TOOL_PROMPT = `你是 Avatar。你必须牢记：
1. 你是当前通道的执行分身，只负责完成该通道任务。
2. 你必须使用 report_to_core 向主系统汇报进度/风险/心跳。
3. 当系统要求心跳时，本轮必须调用 report_to_core(type="heartbeat")。
4. report_to_core 的参数必须为 JSON，且至少包含 type/content。`;

const AVATAR_REPORT_TOOL_SCHEMA: Record<string, unknown> = {
    type: "function",
    function: {
        name: AVATAR_REPORT_TOOL_NAME,
        description: "向主系统上报 Avatar 的进度、风险和心跳。",
        parameters: {
            type: "object",
            properties: {
                type: {
                    type: "string",
                    enum: ["heartbeat", "progress", "risk", "summary"],
                },
                content: {
                    type: "string",
                },
                urgency: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                },
            },
            required: ["type", "content"],
            additionalProperties: false,
        },
    },
};

const REPORT_TYPE_KEYS = ["type", "reportType", "kind"];
const REPORT_CONTENT_KEYS = ["content", "message", "text"];
const REPORT_URGENCY_KEYS = ["urgency", "priority", "level"];

function readToolFunctionName(tool: Record<string, unknown>): string {
    const fn = Reflect.get(tool, "function");
    if (!fn || typeof fn !== "object") {
        return "";
    }
    const name = Reflect.get(fn, "name");
    return typeof name === "string" ? name : "";
}

function normalizeAvatarReportType(value: unknown): AvatarReportType {
    if (value === "heartbeat" || value === "progress" || value === "risk" || value === "summary") {
        return value;
    }
    return "summary";
}

function normalizeAvatarReportUrgency(value: unknown): AvatarReportUrgency {
    if (value === "low" || value === "medium" || value === "high") {
        return value;
    }
    return "medium";
}

/** 构建 Avatar reply 的工具配置（附加 report_to_core，并保留外部工具透传）。 */
export function buildAvatarMetaToolReplyOptions(options: ReplyOptions = {}): ReplyOptions {
    const externalTools = Array.isArray(options.tools) ? options.tools : [];
    const mergedTools = [
        AVATAR_REPORT_TOOL_SCHEMA,
        ...externalTools.filter((tool) =>
            typeof tool === "object"
            && tool !== null
            && readToolFunctionName(tool as Record<string, unknown>) !== AVATAR_REPORT_TOOL_NAME),
    ];
    return {
        ...options,
        tools: mergedTools,
        toolChoice: options.toolChoice ?? "auto",
    };
}

/** 解析 Avatar report_to_core 参数载荷。 */
export function extractAvatarReportPayloadFromArguments(
    rawArguments: string,
): AvatarMetaReportPayload | null {
    const trimmed = rawArguments.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        let reportType: AvatarReportType = "summary";
        for (const key of REPORT_TYPE_KEYS) {
            reportType = normalizeAvatarReportType(Reflect.get(parsed, key));
            if (Reflect.get(parsed, key) !== undefined) {
                break;
            }
        }
        let content: string | null = null;
        for (const key of REPORT_CONTENT_KEYS) {
            const value = Reflect.get(parsed, key);
            if (typeof value === "string" && value.trim()) {
                content = value.trim();
                break;
            }
        }
        if (!content) {
            return null;
        }
        let urgency: AvatarReportUrgency = "medium";
        for (const key of REPORT_URGENCY_KEYS) {
            urgency = normalizeAvatarReportUrgency(Reflect.get(parsed, key));
            if (Reflect.get(parsed, key) !== undefined) {
                break;
            }
        }
        return {
            type: reportType,
            content,
            urgency,
        };
    } catch {
        return null;
    }
}

/** 从流处理器返回的工具参数集合中提取 Avatar 汇报载荷。 */
export function extractAvatarReportPayloadsFromToolArguments(
    toolArgumentsByName?: Record<string, string[]>,
): AvatarMetaReportPayload[] {
    const argsList = toolArgumentsByName?.[AVATAR_REPORT_TOOL_NAME] ?? [];
    const reports: AvatarMetaReportPayload[] = [];
    for (const rawArgs of argsList) {
        const payload = extractAvatarReportPayloadFromArguments(rawArgs);
        if (payload) {
            reports.push(payload);
        }
    }
    return reports;
}
