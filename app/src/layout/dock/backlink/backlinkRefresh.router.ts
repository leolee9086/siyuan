import {zodCalibur, zodState} from "calibur-router/zod";
import type {BacklinkRefreshCause, BacklinkRefreshRequest} from "./backlinkRefresh.types";

const BACKLINK_REFRESH_CAUSES = ["dynamic-ref-text", "ref-count", "rename", "sync", "transactions"] as const;

export type BacklinkRefreshCommand =
    | Readonly<{kind: "refresh-now"}>
    | Readonly<{kind: "schedule-after-index"}>;

const refreshState = zodState.object({
    cause: zodState.enumerated(...BACKLINK_REFRESH_CAUSES),
    scope: zodState.enumerated("all", "targeted"),
});

const backlinkRefreshRouter = zodCalibur
    .universe(refreshState)
    .split(zodState.object({cause: zodState.literal("ref-count"), scope: zodState.literal("targeted")}), () => ({kind: "refresh-now"}) as const)
    .split(zodState.object({cause: zodState.literal("sync")}), () => ({kind: "refresh-now"}) as const)
    .remain(() => ({kind: "schedule-after-index"}) as const)
    .build();

/** Partitions refresh causality before the scheduler performs any I/O. */
export const resolveBacklinkRefreshCommand = (request: BacklinkRefreshRequest): BacklinkRefreshCommand =>
    backlinkRefreshRouter({
        cause: request.cause satisfies BacklinkRefreshCause,
        scope: request.scope.kind,
    });
