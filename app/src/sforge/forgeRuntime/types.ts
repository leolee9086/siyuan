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
