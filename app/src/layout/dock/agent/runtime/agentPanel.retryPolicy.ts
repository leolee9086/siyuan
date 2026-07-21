/**
 * 用途：约束重发策略的最小输入形状，避免策略依赖完整会话模型。
 * 使用范围：仅供本文件的纯策略判断使用，不进入 UI、存储或网络边界。
 * 解耦评估：类型已是参数契约本身；继续通过依赖注入拆分不会减少依赖，反而会隐藏必需输入。
 */
import type {AgentPanelRetryPolicyState} from "./agentPanel.retryPolicy.types";

/**
 * 作用：判断最近用户轮次是否可以原样重发。
 * 意图：在没有完整事务检查点时，阻止工具及交互副作用被重复执行。
 * 调用时机：错误卡或回复动作渲染时，以及用户实际触发重发之前。
 * 问题/改进：当前按所有工具调用从严处理，后续可消费可信的只读/写入工具声明。
 * @同步豁免: UI构建 - 动作按钮必须在同一渲染帧内依据内存快照确定可见性，函数无 I/O 或异步状态。
 */
export function canRetryLastUserTurn(state: AgentPanelRetryPolicyState) {
    if ((state.activeToolCallCount || 0) > 0 || (state.pendingConfirmationCount || 0) > 0) {
        return false;
    }
    let lastUserIndex = -1;
    for (let i = state.entries.length - 1; i >= 0; i--) {
        const entry = state.entries[i];
        // 从后向前定位本次将被重放的用户请求，历史轮次不影响当前决策。
        if (entry.type === "user") {
            lastUserIndex = i;
            break;
        }
    }
    if (lastUserIndex < 0) {
        return false;
    }
    for (let i = lastUserIndex + 1; i < state.entries.length; i++) {
        const entry = state.entries[i];
        if (entry.type === "confirm" || entry.type === "question" ||
            entry.type === "snapshot" || entry.type === "rollback") {
            return false;
        }
        if (entry.type === "assistant" && (entry.toolCalls?.length || 0) > 0) {
            return false;
        }
    }
    return true;
}
