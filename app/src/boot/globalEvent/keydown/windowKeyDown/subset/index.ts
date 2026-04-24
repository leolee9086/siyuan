/**
 * 用途：根据根路由已经选出的目标子集，执行对应的命令处理器。
 * 使用范围：仅供 `windowKeyDown.ts` 在 `route/` 阶段完成后调用。
 * 解耦评估：当前文件只负责“子集入口分发 + UI 子集落地”，不回看 facts，从而保持“路由导航 => 子集处理”的单向流程。
 */

import type { WindowKeyDownResolvedCommands } from "./imports";
import type { WindowKeyDownRouteDomain } from "./imports";
import type { WindowKeyDownState } from "./imports";
import { bindAVPanelKeydown } from "./imports";
import { bindMenuKeydown } from "./imports";
import { calibur } from "./imports";
import { type } from "./imports";
import { UI_WINDOW_KEY_COMMANDS } from "./imports";
import { executeDialogWindowKeyCommand } from "./dialog";
import { executeNavigationWindowKeyCommand } from "./navigation";
import { executeSystemWindowKeyCommand } from "./system";

const finalizeLegacyUIWindowKeyHandling = (event: KeyboardEvent, handled: boolean) => {
    if (handled) {
        event.preventDefault();
    }
    return handled;
};

const executeIgnoredUIWindowKeyCommand = async () => false;

const uiWindowKeyCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${UI_WINDOW_KEY_COMMANDS.IGNORE}'` }), () => executeIgnoredUIWindowKeyCommand)
    .split(
        type({ command: `'${UI_WINDOW_KEY_COMMANDS.MENU}'` }),
        () => async (state: WindowKeyDownState) => finalizeLegacyUIWindowKeyHandling(state.event, !!bindMenuKeydown(state.event)),
    )
    .remain(
        () => async (state: WindowKeyDownState) => finalizeLegacyUIWindowKeyHandling(state.event, !!bindAVPanelKeydown(state.event)),
    )
    .build();

const executeUIWindowKeyCommand = async (command: WindowKeyDownResolvedCommands["uiCommand"], state: WindowKeyDownState) => {
    const executor = uiWindowKeyCommandRouter({ command });
    return executor(state);
};

const windowKeyDownSubsetRouter = calibur
    .universe(type({ domain: "'dialog' | 'ui' | 'system' | 'navigation'" }))
    .split(
        type({ domain: "'dialog'" }),
        () => (resolvedCommands: WindowKeyDownResolvedCommands) => (state: WindowKeyDownState) => executeDialogWindowKeyCommand(resolvedCommands.dialogCommand, state),
    )
    .split(
        type({ domain: "'ui'" }),
        () => (resolvedCommands: WindowKeyDownResolvedCommands) => (state: WindowKeyDownState) => executeUIWindowKeyCommand(resolvedCommands.uiCommand, state),
    )
    .split(
        type({ domain: "'system'" }),
        () => (resolvedCommands: WindowKeyDownResolvedCommands) => (state: WindowKeyDownState) => executeSystemWindowKeyCommand(resolvedCommands.systemCommand, state),
    )
    .remain(
        () => (resolvedCommands: WindowKeyDownResolvedCommands) => (state: WindowKeyDownState) => executeNavigationWindowKeyCommand(resolvedCommands.navigationCommand, state),
    )
    .build();

export const executeWindowKeyDownSubset = async (
    domain: WindowKeyDownRouteDomain,
    resolvedCommands: WindowKeyDownResolvedCommands,
    state: WindowKeyDownState,
) => {
    const executorFactory = windowKeyDownSubsetRouter({ domain });
    const executor = executorFactory(resolvedCommands);
    return executor(state);
};
