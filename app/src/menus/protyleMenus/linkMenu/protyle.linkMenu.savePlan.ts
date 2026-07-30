import {zodCalibur, zodState} from "calibur-router/zod";

export const LINK_MENU_SAVE_COMMANDS = {
    NO_CHANGE: "no-change",
    UPDATE_CURRENT_BLOCK: "update-current-block",
    UPDATE_CAPTURED_BLOCKS: "update-captured-blocks",
} as const;

export type LinkMenuSaveSnapshot = Readonly<{
    blockId: string;
    previousHTML: string;
    nextHTML: string;
}>;

export type LinkMenuSaveBaseline = "current-block" | "captured-blocks";

const linkMenuSaveState = zodState.object({
    baseline: zodState.enumerated("current-block", "captured-blocks"),
    hasChanges: zodState.boolean(),
});

/**
 * 将链接菜单关闭时的持久化条件划分为无写入、单块更新和多块原子更新。
 * 事务执行者只消费明确命令，不从 DOM 状态反推应走的持久化路径。
 */
const routeLinkMenuSaveCommand = zodCalibur
    .universe(linkMenuSaveState)
    .split(
        zodState.object({hasChanges: zodState.literal(false)}),
        () => LINK_MENU_SAVE_COMMANDS.NO_CHANGE,
    )
    .split(
        zodState.object({
            baseline: zodState.literal("current-block"),
            hasChanges: zodState.literal(true),
        }),
        () => LINK_MENU_SAVE_COMMANDS.UPDATE_CURRENT_BLOCK,
    )
    .remain(() => LINK_MENU_SAVE_COMMANDS.UPDATE_CAPTURED_BLOCKS)
    .build();

export type LinkMenuSavePlan = Readonly<{
    command: typeof LINK_MENU_SAVE_COMMANDS[keyof typeof LINK_MENU_SAVE_COMMANDS];
    updates: readonly LinkMenuSaveSnapshot[];
}>;

/** 构造不含 DOM 引用的保存计划，供菜单执行层和回归测试共同使用。 */
export const createLinkMenuSavePlan = (
    baseline: LinkMenuSaveBaseline,
    snapshots: readonly LinkMenuSaveSnapshot[],
): LinkMenuSavePlan => {
    const updates = snapshots.filter((snapshot) => snapshot.previousHTML !== snapshot.nextHTML);
    return {
        command: routeLinkMenuSaveCommand({
            baseline,
            hasChanges: updates.length > 0,
        }),
        updates,
    };
};
