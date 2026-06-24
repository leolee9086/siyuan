/** 用途：引入每日笔记入口。使用范围：仅供 dailyNote 命令执行器调用。解耦评估：通过同目录网关转发业务入口，保持拆分文件依赖边界集中。 */
import { newDailyNote } from "./imports";
/** 用途：引入历史面板入口。使用范围：仅供 dataHistory 命令执行器调用。解耦评估：命令层只触发历史 UI，不展开内部流程。 */
import { openHistory } from "./imports";
/** 用途：引入编辑器设置运行时 API。使用范围：仅供 editReadonly 命令执行器调用。解耦评估：复用设置命名空间写入逻辑。 */
import { editorConfigApi } from "./imports";
/** 用途：引入配置访问器。使用范围：仅供 editReadonly 命令读取当前只读状态。解耦评估：通过环境封装访问全局配置，避免新增直接 window 访问。 */
import { getSiyuanConfig } from "./imports";
/** 用途：引入锁屏入口。使用范围：仅供 lockScreen 命令执行器调用。解耦评估：锁屏是系统对话边界，命令层保持触发职责。 */
import { lockScreen } from "./imports";
/** 用途：引入新建文档入口。使用范围：仅供 newFile 命令执行器调用。解耦评估：文档创建流程继续由文件模块封装。 */
import { newFile } from "./imports";
/** 用途：引入闪卡入口。使用范围：仅供 riffCard 命令执行器调用。解耦评估：命令层不直接依赖闪卡内部状态。 */
import { openCard } from "./imports";
/** 用途：引入打开标签选择入口。使用范围：仅供 selectOpen1 命令执行器调用。解耦评估：布局 Dock 层公开入口通过网关集中转发。 */
import { selectOpenTab } from "./imports";
/** 用途：引入同步引导入口。使用范围：仅供 syncNow 命令执行器调用。解耦评估：同步流程由 syncGuide 编排，命令层仅负责触发。 */
import { syncGuide } from "./imports";
/** 用途：引入 CaliburRouter 构建 command 路由。使用范围：仅用于本文件通用命令路由定义。解耦评估：路由 DSL 集中在命令分发层使用。 */
import { calibur } from "./imports";
/** 用途：引入 arktype 类型声明器。使用范围：仅与 calibur.split 配套声明命令模式。解耦评估：属于路由 schema 基础设施。 */
import { type } from "./imports";
/** 用途：引入通用命令常量。使用范围：仅用于本文件 split 条件。解耦评估：集中命令契约，避免散落字符串。 */
import { COMMON_GLOBAL_COMMANDS } from "./commands";
/** 用途：引入全局命令上下文类型。使用范围：仅作为执行器签名类型使用。解耦评估：类型契约来自同目录命令边界。 */
import type { GlobalCommandContext } from "./types";

/** 执行每日笔记命令。 */
const executeDailyNoteCommonGlobalCommand = ({ app }: GlobalCommandContext) => {
    newDailyNote(app);
    return true;
};

/** 执行数据历史命令。 */
const executeDataHistoryCommonGlobalCommand = ({ app }: GlobalCommandContext) => {
    openHistory(app);
    return true;
};

/** 执行只读模式切换命令。 */
const executeEditReadonlyCommonGlobalCommand = () => {
    editorConfigApi.patch("editor.readOnly", !getSiyuanConfig().editor.readOnly);
    return true;
};

/** 执行锁屏命令。 */
const executeLockScreenCommonGlobalCommand = ({ app }: GlobalCommandContext) => {
    lockScreen(app);
    return true;
};

/** 执行新建文档命令。 */
const executeNewFileCommonGlobalCommand = ({ app }: GlobalCommandContext) => {
    newFile({
        app,
        useSavePath: true,
    });
    return true;
};

/** 执行闪卡命令。 */
const executeRiffCardCommonGlobalCommand = ({ app }: GlobalCommandContext) => {
    openCard(app);
    return true;
};

/** 执行选择已打开标签命令。 */
const executeSelectOpenCommonGlobalCommand = () => {
    selectOpenTab();
    return true;
};

/** 执行立即同步命令。 */
const executeSyncNowCommonGlobalCommand = ({ app }: GlobalCommandContext) => {
    syncGuide(app);
    return true;
};

/** 通用命令叶子路由，将不区分平台的命令映射为对应执行器。 */
const commonGlobalCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${COMMON_GLOBAL_COMMANDS.DAILY_NOTE}'` }), () => executeDailyNoteCommonGlobalCommand)
    .split(type({ command: `'${COMMON_GLOBAL_COMMANDS.DATA_HISTORY}'` }), () => executeDataHistoryCommonGlobalCommand)
    .split(type({ command: `'${COMMON_GLOBAL_COMMANDS.EDIT_READONLY}'` }), () => executeEditReadonlyCommonGlobalCommand)
    .split(type({ command: `'${COMMON_GLOBAL_COMMANDS.LOCK_SCREEN}'` }), () => executeLockScreenCommonGlobalCommand)
    .split(type({ command: `'${COMMON_GLOBAL_COMMANDS.NEW_FILE}'` }), () => executeNewFileCommonGlobalCommand)
    .split(type({ command: `'${COMMON_GLOBAL_COMMANDS.RIFF_CARD}'` }), () => executeRiffCardCommonGlobalCommand)
    .split(type({ command: `'${COMMON_GLOBAL_COMMANDS.SELECT_OPEN_1}'` }), () => executeSelectOpenCommonGlobalCommand)
    .remain(() => executeSyncNowCommonGlobalCommand)
    .build();

/**
 * 执行通用全局命令。
 * @同步豁免: UI构建 - globalCommand 是同步入口，通用命令需要立即触发 UI 或配置状态变更并返回已处理状态。
 */
export const executeCommonGlobalCommand = (context: GlobalCommandContext) => {
    const executor = commonGlobalCommandRouter({ command: context.command });
    return executor(context);
};
