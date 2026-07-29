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

export type ForgeRuntimeStatusData = z.infer<typeof forgeRuntimeStatusDataSchema>;
export type ForgeSupervisorStatus = z.infer<typeof forgeSupervisorStatusSchema>;
export type ForgeRuntimeJob = z.infer<typeof forgeRuntimeJobSchema>;
export type ForgeRuntimeRestartResponse = z.infer<typeof forgeRuntimeRestartResponseSchema>;
export type ForgeRuntimeApprovalResponse = z.infer<typeof forgeRuntimeApprovalResponseSchema>;

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
