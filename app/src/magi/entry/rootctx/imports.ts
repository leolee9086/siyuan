/**
 * 用途：集中转发 MagiRoot 上下文拆分模块依赖。
 * 使用范围：`app/src/magi/entry/rootctx/` 下所有业务文件。
 * 解耦评估：该文件作为本目录导入网关存在，已是满足仓库导入规约的最小耦合方案。
 */

/** 用途：创建计算属性；使用范围：rootctx 视图派生与上下文装配；解耦评估：Vue 响应式基础能力，通过 imports.ts 转发可避免业务文件直接依赖第三方包。 */
import { computed, watch } from "vue";
/** 导出 computed。 */
export { computed };
/** 导出 watch。 */
export { watch };

/** 用途：创建响应式引用；使用范围：rootctx 状态容器初始化；解耦评估：Vue 响应式基础能力，通过 imports.ts 转发可保持目录边界稳定。 */
import { ref } from "vue";
/** 导出 ref。 */
export { ref };

/** 用途：标注计算属性类型；使用范围：rootctx 局部类型约束；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { ComputedRef } from "vue";
/** 导出类型 ComputedRef。 */
export type { ComputedRef };

/** 用途：标注响应式引用类型；使用范围：rootctx 函数参数与状态结构约束；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { Ref } from "vue";
/** 导出类型 Ref。 */
export type { Ref };

/** 用途：初始化 MAGI 运行时；使用范围：工作空间守卫通过后启动 useMagi；解耦评估：entry 上下文必须触达 composable 启动入口，当前通过 imports.ts 收口已是最小耦合。 */
import { useMagi } from "../../composables/useMagi";
/** 导出 useMagi。 */
export { useMagi };

/** 用途：向共识消息流追加系统/错误提示；使用范围：导出记录等动作反馈；解耦评估：该能力属于 MAGI 主面板消息域，通过 imports.ts 转发可避免业务文件跨层直连。 */
import { appendConsensusMessage } from "../../composables/useMagi.consensus";
/** 导出 appendConsensusMessage。 */
export { appendConsensusMessage };

/** 用途：导出 MAGI 会话详细记录；使用范围：EXPORT LOG 动作；解耦评估：导出能力已抽到独立 composable，通过 imports.ts 转发即可。 */
import { exportMagiSessionRecord } from "../../composables/useMagi.export";
/** 导出 exportMagiSessionRecord。 */
export { exportMagiSessionRecord };

/** 用途：标注运行时状态类型；使用范围：rootctx 计算属性类型约束；解耦评估：纯类型依赖，适合通过 imports.ts 转发。 */
import type { MagiRuntimeStatus } from "../../composables/useMagi.types";
/** 导出类型 MagiRuntimeStatus。 */
export type { MagiRuntimeStatus };

/** 用途：标注来源模拟请求上下文；使用范围：source simulation 请求载荷拼装；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationContext } from "../../composables/useMagi.types";
/** 导出类型 SourceSimulationContext。 */
export type { SourceSimulationContext };

/** 用途：标注 useMagi 返回结构；使用范围：rootctx 状态、动作与计算属性；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { UseMagiReturn } from "../../composables/useMagi.types";
/** 导出类型 UseMagiReturn。 */
export type { UseMagiReturn };

/** 用途：标注运行时贤者包装对象；使用范围：Seel 视图映射；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { WrappedSeel } from "../../composables/useMagi.types";
/** 导出类型 WrappedSeel。 */
export type { WrappedSeel };

/** 用途：创建问卷保存后的消息处理器；使用范围：PersonaSeedPanel 保存回写主消息流；解耦评估：业务动作已抽离为独立 composable，通过 imports.ts 转发可保持 entry 装配层简洁。 */
import { createQuestionnaireSavedHandler } from "../../composables/root/MagiRoot.questionnaire";
/** 导出 createQuestionnaireSavedHandler。 */
export { createQuestionnaireSavedHandler };

/** 用途：读取工作空间 AI 主笔记本状态；使用范围：启动守卫与刷新动作；解耦评估：service 层已封装请求细节，entry 仅消费稳定接口，通过 imports.ts 转发即可。 */
import { fetchWorkspaceAIMainNotebookState } from "../../service/aiMainNotebook";
/** 导出 fetchWorkspaceAIMainNotebookState。 */
export { fetchWorkspaceAIMainNotebookState };

/** 用途：创建工作空间 AI 主笔记本；使用范围：缺失守卫页创建动作；解耦评估：service 层已封装请求细节，通过 imports.ts 转发可避免业务文件跨层导入。 */
import { createWorkspaceAIMainNotebook } from "../../service/aiMainNotebook";
/** 导出 createWorkspaceAIMainNotebook。 */
export { createWorkspaceAIMainNotebook };

/** 用途：打开指定 AI 主笔记本；使用范围：检测到活跃主笔记本处于关闭状态时补偿打开；解耦评估：service 层已收口请求，通过 imports.ts 转发即可。 */
import { openWorkspaceAIMainNotebook } from "../../service/aiMainNotebook";
/** 导出 openWorkspaceAIMainNotebook。 */
export { openWorkspaceAIMainNotebook };

/** 用途：解决工作空间 AI 主笔记本冲突；使用范围：守卫页选择保留打开的笔记本；解耦评估：service 层已封装请求，通过 imports.ts 转发是合理边界。 */
import { resolveWorkspaceAIMainNotebookConflict } from "../../service/aiMainNotebook";
/** 导出 resolveWorkspaceAIMainNotebookConflict。 */
export { resolveWorkspaceAIMainNotebookConflict };

/** 用途：标注工作空间 AI 主笔记本完整状态；使用范围：rootctx 状态与计算属性；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { WorkspaceAIMainNotebookState } from "../../service/aiMainNotebook.types";
/** 导出类型 WorkspaceAIMainNotebookState。 */
export type { WorkspaceAIMainNotebookState };

/** 用途：标注工作空间 AI 主笔记本状态字面量；使用范围：守卫状态判断与提示；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { WorkspaceAIMainNotebookStatus } from "../../service/aiMainNotebook.types";
/** 导出类型 WorkspaceAIMainNotebookStatus。 */
export type { WorkspaceAIMainNotebookStatus };

/** 用途：登录来源模拟身份会话；使用范围：source simulation 提交前获取 armor token；解耦评估：service 接口属于外部能力，当前通过 imports.ts 转发可降低路径耦合。 */
import { loginMagiIdentity } from "../../service/magiIdentitySession";
/** 导出 loginMagiIdentity。 */
export { loginMagiIdentity };

/** 用途：标注来源模拟请求信道类型；使用范围：source simulation 提交参数类型约束；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { MagiRequestChannel } from "../../service/magiIdentitySession";
/** 导出类型 MagiRequestChannel。 */
export type { MagiRequestChannel };

/** 用途：读取当前平台运行环境；使用范围：窗口控制显示与 Electron 守卫；解耦评估：平台能力属于基础设施，通过 imports.ts 转发可避免业务模块直接上跳平台目录。 */
import { isElectron } from "../../../platform";
/** 导出 isElectron。 */
export { isElectron };

/** 用途：读取当前是否移动端；使用范围：窗口控制显示判断；解耦评估：平台能力属于基础设施，通过 imports.ts 转发更符合目录边界约束。 */
import { isMobile } from "../../../platform";
/** 导出 isMobile。 */
export { isMobile };

/** 用途：向 Electron 主进程发送窗口命令；使用范围：打开控制台、最小化、关闭窗口；解耦评估：平台通信能力属于外部依赖，通过 imports.ts 转发更稳定。 */
import { ipcSend } from "../../../platform/electron/ipcRenderer";
/** 导出 ipcSend。 */
export { ipcSend };

/** 用途：向 Electron 主进程请求窗口状态；使用范围：切换最大化前查询当前状态；解耦评估：平台通信能力属于外部依赖，通过 imports.ts 转发更稳定。 */
import { ipcInvoke } from "../../../platform/electron/ipcRenderer";
/** 导出 ipcInvoke。 */
export { ipcInvoke };

/** 用途：读取窗口命令常量；使用范围：窗口控制 handler 下发 Electron 指令；解耦评估：常量属于共享基础设施，通过 imports.ts 转发可避免业务文件直接跨层耦合。 */
import { Constants } from "../../../constants";
/** 导出 Constants。 */
export { Constants };

/** 用途：展示界面消息提示；使用范围：工作空间冲突提示等 UI 反馈；解耦评估：消息能力属于 UI 基础设施，通过 imports.ts 转发可避免业务模块直接跨层耦合。 */
import { showMessage } from "../../../dialog/message";
/** 导出 showMessage。 */
export { showMessage };

/** 用途：标注贤者连接摘要视图；使用范围：标题栏同步率计算；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { MagiSeelConnectionView } from "../magiView.types";
/** 导出类型 MagiSeelConnectionView。 */
export type { MagiSeelConnectionView };

/** 用途：标注贤者面板视图；使用范围：sage/monitor 视图映射；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { MagiSeelPanelView } from "../magiView.types";
/** 导出类型 MagiSeelPanelView。 */
export type { MagiSeelPanelView };

/** 用途：标注 MagiRoot 最终上下文结构；使用范围：`useMagiRootContext` 返回值约束；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { MagiRootContext } from "../MagiRoot.types";
/** 导出类型 MagiRootContext。 */
export type { MagiRootContext };

/** 用途：标注来源模拟面板消息结构；使用范围：source simulation 消息构造；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationPanelMessageView } from "../MagiRoot.types";
/** 导出类型 SourceSimulationPanelMessageView。 */
export type { SourceSimulationPanelMessageView };

/** 用途：标注来源模拟面板结构；使用范围：source simulation 状态与 handler 参数；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationPanelView } from "../MagiRoot.types";
/** 导出类型 SourceSimulationPanelView。 */
export type { SourceSimulationPanelView };

/** 用途：标注来源模拟画像结构；使用范围：source simulation 默认画像与选择逻辑；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationProfileView } from "../MagiRoot.types";
/** 导出类型 SourceSimulationProfileView。 */
export type { SourceSimulationProfileView };

/** 用途：标注来源模拟最小状态端口；使用范围：来源模拟操作参数；解耦评估：通过 imports.ts 转发纯类型契约，避免反向导入状态工厂。 */
import type { SourceSimulationStatePort } from "../MagiRoot.types";
/** 导出类型 SourceSimulationStatePort。 */
export type { SourceSimulationStatePort };
