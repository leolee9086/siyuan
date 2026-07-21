/** 用途：创建 rootctx 响应式状态；使用范围：MagiRoot 状态初始化；解耦评估：已通过同目录 imports.ts 转发 Vue API，符合目录边界约束。 */
import { ref } from "./imports";
/** 用途：标注 MAGI 运行时状态引用；使用范围：magiState 容器类型约束；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { UseMagiReturn } from "./imports";
/** 用途：标注工作空间 AI 主笔记本状态；使用范围：守卫状态容器类型约束；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { WorkspaceAIMainNotebookState } from "./imports";
/** 用途：生成来源模拟默认画像副本；使用范围：初始化 source simulation 状态；解耦评估：同目录模块职责清晰，直接依赖合理。 */
import { createSourceSimulationProfileOptions } from "./MagiRoot.sourceSimulation";
/** 用途：生成来源模拟默认面板；使用范围：初始化 source simulation 面板列表；解耦评估：同目录模块职责清晰，直接依赖合理。 */
import { createDefaultSourceSimulationPanels } from "./MagiRoot.sourceSimulation";

/**
 * 作用：创建 MagiRoot 所需的基础响应式状态容器。
 * 意图：把 setup 阶段的状态初始化从入口函数中拆出，降低 `useMagiRootContext` 复杂度。
 * 调用时机：`useMagiRootContext` 开始执行时调用一次。
 */
/** @同步豁免: UI构建 — setup 阶段必须同步创建响应式状态容器。 */
export function createMagiRootState() {
    const profiles = createSourceSimulationProfileOptions();
    return {
        ready: ref(false),
        destroyed: ref(false),
        bootError: ref<string | null>(null),
        showMessages: ref(true),
        showSeels: ref(true),
        showMonitor: ref(true),
        showQuestionnairePanel: ref(false),
        workspaceAIMainNotebookState: ref<WorkspaceAIMainNotebookState | null>(null),
        workspaceAIMainNotebookLoading: ref(true),
        workspaceAIMainNotebookActionLoading: ref(false),
        workspaceAIMainNotebookError: ref<string | null>(null),
        sourceSimulationProfiles: ref(profiles),
        sourceSimulationPanels: ref(createDefaultSourceSimulationPanels(profiles)),
        magiState: ref<UseMagiReturn | null>(null),
    };
}
