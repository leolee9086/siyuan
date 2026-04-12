/** 用途：创建问卷保存后的消息处理器；使用范围：PersonaSeedPanel 保存结果回写主消息流；解耦评估：该能力已通过 imports.ts 收口，当前依赖边界清晰。 */
import { createQuestionnaireSavedHandler } from "./imports";
/** 用途：读取 Electron 运行环境标志；使用范围：窗口控制动作与控制台动作守卫；解耦评估：平台能力已通过 imports.ts 收口，当前依赖边界清晰。 */
import { isElectron } from "./imports";
/** 用途：向 Electron 主进程发送窗口命令；使用范围：控制台、最小化、关闭动作；解耦评估：平台通信能力已通过 imports.ts 收口，当前依赖边界清晰。 */
import { ipcSend } from "./imports";
/** 用途：向 Electron 主进程查询窗口状态；使用范围：切换最大化前检查当前窗口状态；解耦评估：平台通信能力已通过 imports.ts 收口，当前依赖边界清晰。 */
import { ipcInvoke } from "./imports";
/** 用途：读取窗口命令常量；使用范围：窗口控制 handler 下发 Electron 指令；解耦评估：共享常量已通过 imports.ts 收口，当前依赖边界清晰。 */
import { Constants } from "./imports";
/** 用途：标注 rootctx 状态工厂；使用范围：handler 模块通过 ReturnType 推导完整状态结构；解耦评估：纯类型依赖，直接依赖同目录状态模块合理。 */
import type { createMagiRootState } from "./MagiRoot.state";
/** 用途：创建 MagiRoot 主动作 handlers；使用范围：提交输入、问卷、重连、导出动作；解耦评估：同目录动作模块职责清晰，直接依赖合理。 */
import { createMagiRootActionHandlers } from "./MagiRoot.actions";
/** 用途：创建工作空间守卫 handlers；使用范围：刷新、创建、冲突解决动作；解耦评估：同目录 workspace 模块职责清晰，直接依赖合理。 */
import { createWorkspaceNotebookHandlers } from "./MagiRoot.workspace";
/** 用途：处理新增来源模拟面板动作；使用范围：来源模拟状态变更 handler 闭包；解耦评估：同目录来源模拟模块职责清晰，直接依赖合理。 */
import { handleCreateSourceSimulationPanel } from "./MagiRoot.sourceSimulation";
/** 用途：处理删除来源模拟面板动作；使用范围：来源模拟状态变更 handler 闭包；解耦评估：同目录来源模拟模块职责清晰，直接依赖合理。 */
import { handleRemoveSourceSimulationPanel } from "./MagiRoot.sourceSimulation";
/** 用途：处理来源模拟输入更新动作；使用范围：来源模拟状态变更 handler 闭包；解耦评估：同目录来源模拟模块职责清晰，直接依赖合理。 */
import { handleUpdateSourceSimulationInput } from "./MagiRoot.sourceSimulation";
/** 用途：处理来源模拟画像更新动作；使用范围：来源模拟状态变更 handler 闭包；解耦评估：同目录来源模拟模块职责清晰，直接依赖合理。 */
import { handleUpdateSourceSimulationProfile } from "./MagiRoot.sourceSimulation";
/** 用途：处理来源模拟请求字段更新动作；使用范围：来源模拟状态变更 handler 闭包；解耦评估：同目录来源模拟模块职责清晰，直接依赖合理。 */
import { handleUpdateSourceSimulationRequestField } from "./MagiRoot.sourceSimulation";
/** 用途：创建来源模拟提交 handler；使用范围：来源模拟请求提交动作；解耦评估：同目录提交流程模块职责清晰，直接依赖合理。 */
import { createSourceSimulationSubmitHandler } from "./MagiRoot.sourceSimulation.submit";

/**
 * 作用：创建打开开发者工具动作。
 * 意图：把 Electron-only 行为从入口层分离，避免模板直接感知平台命令细节。
 * 调用时机：点击 CONSOLE 按钮时调用。
 */
function createOpenConsoleHandler() {
    return async () => {
        if (!isElectron) {
            return;
        }
        ipcSend(Constants.SIYUAN_CMD, "openDevTools");
    };
}

/**
 * 作用：创建窗口最小化动作。
 * 意图：把 Electron-only 行为从入口层分离，避免模板直接感知平台命令细节。
 * 调用时机：点击标题栏最小化按钮时调用。
 */
function createMinimizeWindowHandler() {
    return () => {
        if (!isElectron) {
            return;
        }
        ipcSend(Constants.SIYUAN_CMD, "minimize");
    };
}

/**
 * 作用：创建窗口最大化/还原切换动作。
 * 意图：把最大化状态查询与命令下发收敛为单一 handler。
 * 调用时机：点击标题栏最大化按钮时调用。
 */
function createToggleMaximizeWindowHandler() {
    return async () => {
        if (!isElectron) {
            return;
        }
        const isMaximized = await ipcInvoke<boolean>(Constants.SIYUAN_GET, {
            cmd: "isMaximized",
        });
        ipcSend(Constants.SIYUAN_CMD, isMaximized ? "restore" : "maximize");
    };
}

/**
 * 作用：创建窗口关闭动作。
 * 意图：把 Electron-only 行为从入口层分离，避免模板直接感知平台命令细节。
 * 调用时机：点击标题栏关闭按钮时调用。
 */
function createCloseWindowHandler() {
    return () => {
        if (!isElectron) {
            return;
        }
        ipcSend(Constants.SIYUAN_CMD, "closeButtonBehavior");
    };
}

/**
 * 作用：创建窗口控制 handlers 集合。
 * 意图：把 Electron-only 交互从其余业务动作中独立出来，便于后续维护。
 * 调用时机：`createMagiRootHandlers` 组装最终 handler 时调用。
 */
function createWindowControlHandlers() {
    return {
        onOpenConsole: createOpenConsoleHandler(),
        onMinimizeWindow: createMinimizeWindowHandler(),
        onToggleMaximizeWindow: createToggleMaximizeWindowHandler(),
        onCloseWindow: createCloseWindowHandler(),
    };
}

/**
 * 作用：创建“新增来源模拟面板” handler。
 * 意图：把 rootctx 状态闭包绑定到来源模拟新增动作，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createSourceSimulationHandlers` 组装 handler 时调用。
 */
function createSourceSimulationPanelCreateHandler(
    state: ReturnType<typeof createMagiRootState>,
) {
    return () => handleCreateSourceSimulationPanel(state);
}

/**
 * 作用：创建“删除来源模拟面板” handler。
 * 意图：把 rootctx 状态闭包绑定到来源模拟删除动作，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createSourceSimulationHandlers` 组装 handler 时调用。
 */
function createSourceSimulationPanelRemoveHandler(
    state: ReturnType<typeof createMagiRootState>,
) {
    return (panelId: string) => handleRemoveSourceSimulationPanel(state, panelId);
}

/**
 * 作用：创建“更新来源模拟输入框” handler。
 * 意图：把 rootctx 状态闭包绑定到来源模拟输入更新动作，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createSourceSimulationHandlers` 组装 handler 时调用。
 */
function createSourceSimulationInputUpdateHandler(
    state: ReturnType<typeof createMagiRootState>,
) {
    return (panelId: string, value: string) => handleUpdateSourceSimulationInput(state, panelId, value);
}

/**
 * 作用：创建“更新来源模拟画像” handler。
 * 意图：把 rootctx 状态闭包绑定到来源模拟画像更新动作，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createSourceSimulationHandlers` 组装 handler 时调用。
 */
function createSourceSimulationProfileUpdateHandler(
    state: ReturnType<typeof createMagiRootState>,
) {
    return (panelId: string, profileId: string) => handleUpdateSourceSimulationProfile(state, panelId, profileId);
}

/**
 * 作用：创建“更新来源模拟请求字段” handler。
 * 意图：把 rootctx 状态闭包绑定到来源模拟字段更新动作，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createSourceSimulationHandlers` 组装 handler 时调用。
 */
function createSourceSimulationRequestFieldUpdateHandler(
    state: ReturnType<typeof createMagiRootState>,
) {
    return (
        panelId: string,
        field: "identityId" | "password" | "nickname" | "channel" | "requestModel",
        value: string,
    ) => handleUpdateSourceSimulationRequestField(state, panelId, field, value);
}

/**
 * 作用：创建来源模拟 handlers 集合。
 * 意图：把来源模拟状态更新与提交流程统一装配到根 handler 集合中。
 * 调用时机：`createMagiRootHandlers` 组装最终 handler 时调用。
 */
function createSourceSimulationHandlers(
    state: ReturnType<typeof createMagiRootState>,
) {
    return {
        onCreateSourceSimulationPanel: createSourceSimulationPanelCreateHandler(state),
        onRemoveSourceSimulationPanel: createSourceSimulationPanelRemoveHandler(state),
        onUpdateSourceSimulationInput: createSourceSimulationInputUpdateHandler(state),
        onUpdateSourceSimulationProfile: createSourceSimulationProfileUpdateHandler(state),
        onUpdateSourceSimulationRequestField: createSourceSimulationRequestFieldUpdateHandler(state),
        onSubmitSourceSimulationPanel: createSourceSimulationSubmitHandler(state),
    };
}

/**
 * 作用：创建 MagiRoot 最终事件处理器集合。
 * 意图：让入口层只保留上下文装配逻辑，具体动作分散到各职责模块。
 * 调用时机：`useMagiRootContext` 初始化时调用一次。
 */
/** @同步豁免: UI构建 — setup 阶段需要同步返回事件处理器闭包集合。 */
export function createMagiRootHandlers(
    state: ReturnType<typeof createMagiRootState>,
) {
    return {
        ...createMagiRootActionHandlers(state),
        onQuestionnaireSaved: createQuestionnaireSavedHandler(state.magiState),
        ...createWorkspaceNotebookHandlers(state),
        ...createWindowControlHandlers(),
        ...createSourceSimulationHandlers(state),
    };
}
