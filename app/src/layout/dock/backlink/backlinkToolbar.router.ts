import {zodCalibur, zodState} from "calibur-router/zod";

export const BACKLINK_PRESENTATIONS = ["pin", "local", "bottom"] as const;
export type BacklinkPresentation = typeof BACKLINK_PRESENTATIONS[number];

const BACKLINK_TOOLBAR_ACTIONS = [
    "refresh",
    "mExpand",
    "mCollapse",
    "min",
    "search",
    "sort",
    "mSort",
    "layout",
    "mention",
    "unknown",
] as const;

type BacklinkToolbarAction = typeof BACKLINK_TOOLBAR_ACTIONS[number];

export type BacklinkToolbarCommand =
    | Readonly<{kind: "refresh"}>
    | Readonly<{kind: "expand-mentions"}>
    | Readonly<{kind: "collapse-mentions"}>
    | Readonly<{kind: "minimize"}>
    | Readonly<{kind: "show-filter"}>
    | Readonly<{kind: "show-sort"; sortTarget: "sort" | "mSort"}>
    | Readonly<{kind: "cycle-mention-layout"; layoutTarget: "layout" | "mention"}>
    | Readonly<{kind: "ignore"}>;

const actionState = zodState.object({
    action: zodState.enumerated(...BACKLINK_TOOLBAR_ACTIONS),
    presentation: zodState.enumerated(...BACKLINK_PRESENTATIONS),
});

const backlinkToolbarRouter = zodCalibur
    .universe(actionState)
    .split(zodState.object({action: zodState.literal("refresh")}), () => ({kind: "refresh"}) as const)
    .split(zodState.object({action: zodState.literal("mExpand")}), () => ({kind: "expand-mentions"}) as const)
    .split(zodState.object({action: zodState.literal("mCollapse")}), () => ({kind: "collapse-mentions"}) as const)
    .split(zodState.object({action: zodState.literal("min"), presentation: zodState.literal("pin")}), () => ({kind: "minimize"}) as const)
    .split(zodState.object({action: zodState.literal("search")}), () => ({kind: "show-filter"}) as const)
    .split(zodState.object({action: zodState.literal("sort")}), () => ({kind: "show-sort", sortTarget: "sort"}) as const)
    .split(zodState.object({action: zodState.literal("mSort")}), () => ({kind: "show-sort", sortTarget: "mSort"}) as const)
    .split(zodState.object({action: zodState.literal("layout")}), () => ({kind: "cycle-mention-layout", layoutTarget: "layout"}) as const)
    .split(zodState.object({action: zodState.literal("mention")}), () => ({kind: "cycle-mention-layout", layoutTarget: "mention"}) as const)
    .remain(() => ({kind: "ignore"}) as const)
    .build();

const isBacklinkToolbarAction = (value: string | null): value is BacklinkToolbarAction =>
    value !== null && (BACKLINK_TOOLBAR_ACTIONS as readonly string[]).includes(value);

/**
 * Maps DOM data attributes once, then uses the router for all actionable
 * toolbar state. Unknown or presentation-incompatible controls are ignored.
 */
export const resolveBacklinkToolbarCommand = (
    dataType: string | null,
    presentation: BacklinkPresentation,
): BacklinkToolbarCommand => backlinkToolbarRouter({
    action: isBacklinkToolbarAction(dataType) ? dataType : "unknown",
    presentation,
});
