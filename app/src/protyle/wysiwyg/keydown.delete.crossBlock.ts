import {zodCalibur, zodState} from "calibur-router/zod";

export const CROSS_BLOCK_DELETE_COMMANDS = {
    IGNORE: "ignore",
    REMOVE_CROSS_BLOCK_SELECTION: "remove-cross-block-selection",
    REMOVE_REFERENCE_TARGETED_SELECTION: "remove-reference-targeted-selection",
} as const;

const crossBlockDeleteState = zodState.object({
    removalRequested: zodState.boolean(),
    selection: zodState.enumerated("cross-block-content", "other"),
    hasReferenceTargets: zodState.boolean(),
});

/**
 * 把键盘删除的事实划分为互斥命令空间，执行层只消费明确的删除命令。
 * Calibur 在构建时证明每个 split 不重叠，remain 覆盖其余非删除状态。
 */
export const routeCrossBlockDeleteCommand = zodCalibur
    .universe(crossBlockDeleteState)
    .split(
        zodState.object({removalRequested: zodState.literal(false)}),
        () => CROSS_BLOCK_DELETE_COMMANDS.IGNORE,
    )
    .split(
        zodState.object({
            removalRequested: zodState.literal(true),
            selection: zodState.literal("cross-block-content"),
        }),
        () => CROSS_BLOCK_DELETE_COMMANDS.REMOVE_CROSS_BLOCK_SELECTION,
    )
    .split(
        zodState.object({
            removalRequested: zodState.literal(true),
            selection: zodState.literal("other"),
            hasReferenceTargets: zodState.literal(true),
        }),
        () => CROSS_BLOCK_DELETE_COMMANDS.REMOVE_REFERENCE_TARGETED_SELECTION,
    )
    .remain(() => CROSS_BLOCK_DELETE_COMMANDS.IGNORE)
    .build();
