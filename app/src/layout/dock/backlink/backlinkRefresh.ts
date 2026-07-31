import {getSForgeState, setSForgeState} from "../../../config/sforge.global";
import {SForgeSymbols} from "../../../config/sforge.symbols";
import type {BacklinkRefreshSchedulerState} from "../../../config/sforge.types";
import {getAllModels} from "../../getAll";
import {resolveBacklinkRefreshCommand} from "./backlinkRefresh.router";
import type {BacklinkRefreshRequest} from "./backlinkRefresh.types";

const BACKLINK_REFRESH_DELAY = 3600;

const isBacklinkRefreshSchedulerState = (value: unknown): value is BacklinkRefreshSchedulerState =>
    typeof value === "object" && value !== null && "timer" in value &&
    (typeof value.timer === "number" || value.timer === undefined);

const getBacklinkRefreshSchedulerState = (): BacklinkRefreshSchedulerState => {
    const existingState = getSForgeState(SForgeSymbols.BACKLINK_REFRESH_SCHEDULER);
    if (isBacklinkRefreshSchedulerState(existingState)) {
        return existingState;
    }
    const state: BacklinkRefreshSchedulerState = {timer: undefined};
    setSForgeState(SForgeSymbols.BACKLINK_REFRESH_SCHEDULER, state);
    return state;
};

const matchesRefreshScope = (item: ReturnType<typeof getAllModels>["backlink"][number], request: BacklinkRefreshRequest) => {
    if (item.type !== "bottom") {
        return false;
    }
    if (request.scope.kind === "all") {
        return true;
    }
    return request.scope.relatedBlockIds.includes(item.blockId) ||
        (request.scope.includeRootDescendants && item.rootId === request.scope.rootId);
};

const refreshBottomBacklinks = (request: BacklinkRefreshRequest) => {
    getAllModels().backlink.forEach(item => {
        if (!matchesRefreshScope(item, request)) {
            return;
        }
        item.markDirty();
        item.refreshIfVisible();
    });
};

const scheduleAfterIndex = () => {
    const state = getBacklinkRefreshSchedulerState();
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
        state.timer = undefined;
        refreshBottomBacklinks({cause: "transactions", scope: {kind: "all"}});
    }, BACKLINK_REFRESH_DELAY);
};

/**
 * Routes each Kernel change to either an immediate directed update or one
 * delayed whole-index refresh. Kernel notifications never represent user input.
 */
export const requestBacklinkRefresh = (request: BacklinkRefreshRequest) => {
    const command = resolveBacklinkRefreshCommand(request);
    if (command.kind === "refresh-now") {
        refreshBottomBacklinks(request);
        return;
    }
    scheduleAfterIndex();
};

/** Preserves the upstream transaction/rename scheduling entry point. */
export const scheduleBacklinkRefresh = (cause: "rename" | "transactions" = "transactions") => {
    requestBacklinkRefresh({cause, scope: {kind: "all"}});
};
