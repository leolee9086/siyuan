import {z} from "zod";

export const forgeProtectedTestApprovalSchema = z.object({
    state: z.enum(["pending", "approved", "rejected", "expired"]),
    revision: z.string().min(1),
    paths: z.array(z.string()),
    deadline: z.string().optional(),
    approvedAt: z.string().optional(),
    rejectedAt: z.string().optional(),
    expiredAt: z.string().optional(),
}).passthrough();

export const forgeRuntimeJobSchema = z.object({
    id: z.string().min(1),
    state: z.string().min(1),
    phase: z.string().min(1),
    reason: z.string().default(""),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    error: z.string().default(""),
    protectedTestApproval: forgeProtectedTestApprovalSchema.optional(),
}).passthrough();

export const forgeRuntimeVersionSchema = z.object({
    id: z.string().min(1),
    revision: z.string().min(1),
    state: z.string().min(1),
    createdAt: z.string().optional(),
}).passthrough();

export const forgeSupervisorStatusSchema = z.object({
    mode: z.literal("forge-source-supervisor"),
    lifecycle: z.string().min(1).optional(),
    ready: z.boolean().optional(),
    processId: z.number().int().positive(),
    port: z.number().int().positive(),
    activeVersion: forgeRuntimeVersionSchema,
    job: forgeRuntimeJobSchema.nullable().optional(),
    latestIncident: z.object({
        id: z.string(),
        kind: z.string(),
        state: z.string(),
    }).passthrough().nullable().optional(),
    retainedVersions: z.array(forgeRuntimeVersionSchema).default([]),
}).passthrough();

export const forgeRuntimeStatusDataSchema = z.object({
    available: z.boolean(),
    status: forgeSupervisorStatusSchema.optional(),
});

export const forgeRuntimeRestartResponseSchema = z.object({
    job: forgeRuntimeJobSchema,
}).passthrough();

export const forgeRuntimeApprovalResponseSchema = z.object({
    approval: z.object({
        jobId: z.string().min(1),
        revision: z.string().min(1),
        state: z.enum(["approved", "rejected"]),
    }).passthrough(),
}).passthrough();

/** 校验 Supervisor 经 Kernel exit 广播给浏览器的可恢复热切换身份。 */
export const forgeRuntimeExitContextSchema = z.object({
    mode: z.literal("forge-restart"),
    jobId: z.string().regex(/^[a-zA-Z0-9_.-]{1,80}$/),
    targetRevision: z.string().regex(/^[0-9a-f]{40}$/),
}).strict();

export type ForgeRuntimeStatusData = z.infer<typeof forgeRuntimeStatusDataSchema>;
export type ForgeSupervisorStatus = z.infer<typeof forgeSupervisorStatusSchema>;
export type ForgeRuntimeJob = z.infer<typeof forgeRuntimeJobSchema>;
export type ForgeRuntimeRestartResponse = z.infer<typeof forgeRuntimeRestartResponseSchema>;
export type ForgeRuntimeApprovalResponse = z.infer<typeof forgeRuntimeApprovalResponseSchema>;
/** 可恢复退出的任务与目标版本契约，只在 Forge 热切换链中使用。 */
export type ForgeRuntimeExitContext = z.infer<typeof forgeRuntimeExitContextSchema>;

/** Electron 接续使用的热替换身份；单独命名以区别浏览器隔离页。 */
export type ForgeRuntimeElectronContinuityContext = ForgeRuntimeExitContext;

/** Electron 接续阶段；不复用普通内核故障或退出文案。 */
export type ForgeRuntimeElectronContinuityPhase = "waiting" | "checking";

/** 接续终态；只有 completed 允许 Electron 主界面重载。 */
export type ForgeRuntimeElectronContinuityResult =
    | {state: "completed", revision: string}
    | {state: "rolled_back", revision?: string, detail: string}
    | {state: "failed", detail: string}
    | {state: "rejected", detail: string}
    | {state: "timed_out", detail: string};

/** 接续状态请求能力；测试通过注入响应序列隔离网络边界。 */
export type ForgeRuntimeElectronContinuityFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** 接续运行配置；时钟、等待和阶段回调均可替换以覆盖边界状态。 */
export interface ForgeRuntimeElectronContinuityOptions {
    fetchImpl?: ForgeRuntimeElectronContinuityFetch;
    delay?: (milliseconds: number) => Promise<void>;
    now?: () => number;
    intervalMilliseconds?: number;
    timeoutMilliseconds?: number;
    onPhase?: (phase: ForgeRuntimeElectronContinuityPhase, detail?: string) => void;
}

/** 接续轮询的单次归约结果；用于区分可重试状态与允许刷新界面的终态。 */
export type ForgeRuntimeElectronContinuityAttempt = ForgeRuntimeElectronContinuityResult | {
    state: "retry";
    phase: ForgeRuntimeElectronContinuityPhase;
    detail: string;
};

/** 接续状态机的内部运行配置；由公开配置补齐后供每次轮询共享。 */
export interface ForgeRuntimeElectronContinuityResolvedOptions {
    fetchImpl: ForgeRuntimeElectronContinuityFetch;
    delay: (milliseconds: number) => Promise<void>;
    now: () => number;
    intervalMilliseconds: number;
    timeoutMilliseconds: number;
    requestTimeoutMilliseconds: number;
    onPhase: ForgeRuntimeElectronContinuityOptions["onPhase"];
}

/** 接续状态请求的协议结果；rejected 表示已确认的永久控制面拒绝。 */
export type ForgeRuntimeStatusRequestResult =
    | {status: ForgeRuntimeStatusData}
    | {rejected: string};

/** 接续生命周期的全局注册槽；用于重复事件去重和错误抑制。 */
export interface ForgeRuntimeElectronContinuityState {
    active: boolean;
    context: ForgeRuntimeElectronContinuityContext | undefined;
    promise: Promise<ForgeRuntimeElectronContinuityResult> | undefined;
}

/** 识别 JSON 对象，供状态响应边界读取未知输入。 */
export const isForgeRuntimeRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

export interface ForgeRuntimeControllerState {
    status: ForgeRuntimeStatusData | undefined;
    busy: boolean;
    error: Error | undefined;
}

export const forgeRuntimeTerminalJobStates = new Set(["completed", "failed", "rolled_back"]);

export const isForgeRuntimeJobActive = (job: ForgeRuntimeJob | null | undefined): boolean =>
    Boolean(job && !forgeRuntimeTerminalJobStates.has(job.state));

export const getForgeProtectedApprovalKey = (job: ForgeRuntimeJob): string | undefined => {
    const approval = job.protectedTestApproval;
    if (job.state !== "awaiting_protected_test_approval" || job.phase !== "protected_test_approval" ||
        approval?.state !== "pending") {
        return undefined;
    }
    return `${job.id}\u0000${approval.revision}`;
};
