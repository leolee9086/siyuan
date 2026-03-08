/**
 * @fileoverview NERV内部操作函数
 * @description 提供人格激活报告、执行、过滤、状态保存、API包装、再平衡等操作。
 *   这些函数接收NERVState作为参数，替代原始类的私有方法。
 */

import type { NERVExecutionResult } from "../core.types";
import type { NERVState, ActivationReport, PersonaAPI } from "./nerv.types";
import { calculateSyncStatus, mergePersonaTraits, splitPersona } from "./nerv.helpers";

/**
 * 生成人格激活报告
 * @description 汇总Ghost的状态、激活次数、最后使用时间和同步状态
 * @param state - NERV内部状态
 * @param name - 人格名称
 */
export async function generateActivationReport(
    state: NERVState,
    name: string
): Promise<ActivationReport> {
    const ghost = state.ghosts.get(name);
    // 未注册的人格返回默认报告
    if (!ghost) {
        return { name, state: "inactive", activations: 0, lastUsed: null, syncStatus: { status: "desynced", ratio: 0, confidence: 0, lastExecution: 0 } };
    }
    return {
        name,
        state: ghost.state,
        activations: ghost.activationCount,
        lastUsed: ghost.lastUsed,
        syncStatus: calculateSyncStatus(ghost),
    };
}

/**
 * 使用指定人格执行任务
 * @description 从ghosts Map获取Ghost实例，调用其execute方法并更新lastUsed
 * @param state - NERV内部状态
 * @param name - 人格名称
 * @param task - 待执行任务
 * @param context - 执行上下文
 */
export async function executeWithPersona(
    state: NERVState,
    name: string,
    task: unknown,
    context: unknown
): Promise<NERVExecutionResult> {
    const ghost = state.ghosts.get(name);
    // 未注册人格抛出错误
    if (!ghost) {
        throw new Error(`人格${name}未注册`);
    }
    const result = await ghost.core.execute(task, context);
    ghost.lastUsed = Date.now();
    return result;
}

/**
 * 对执行结果应用人格特定的过滤器
 * @description 原始JS中此函数对data执行数组操作(filter/sort/map)，
 *   但execute()返回的NERVExecutionResult是对象而非数组，属于原始代码中的未生效逻辑。
 *   TS迁移保留函数签名以维持collaborativeProcess调用链完整性，实际为pass-through。
 * @param _name - 人格名称（保留以维持接口一致性）
 * @param data - 原始执行结果
 */
/** @同步豁免: 性能考虑 - 纯数据转换，无I/O */
export function applyPersonaFilter(_name: string, data: NERVExecutionResult): NERVExecutionResult {
    return data;
}

/**
 * 保存人格状态快照
 * @description 将Ghost的激活次数、最后使用时间和人格特质存入personaStates
 * @param state - NERV内部状态
 * @param name - 人格名称
 */
export async function savePersonaState(state: NERVState, name: string): Promise<void> {
    const ghost = state.ghosts.get(name);
    // 未注册人格跳过保存
    if (!ghost) {
        return;
    }
    state.personaStates.set(name, {
        activationCount: ghost.activationCount,
        lastUsed: ghost.lastUsed,
        traits: ghost.core.Persona,
    });
}

/**
 * 包装人格API供外部使用
 * @description 将内部Ghost操作封装为PersonaAPI接口，隐藏NERVState细节
 * @param state - NERV内部状态
 * @param name - 人格名称
 */
/** @同步豁免: 性能考虑 - 纯对象构造，无I/O */
export function wrapPersonaAPI(state: NERVState, name: string): PersonaAPI {
    return {
        /** 委托executeWithPersona执行任务，外部调用者无需感知NERVState */
        execute: (task: unknown) => executeWithPersona(state, name, task, {}),
        /** 获取当前人格的同步状态，用于监控面板和健康检查 */
        getStatus: () => {
            const ghost = state.ghosts.get(name);
            // 未注册人格返回默认同步状态
            if (!ghost) {
                return { status: "desynced" as const, ratio: 0, confidence: 0, lastExecution: 0 };
            }
            return calculateSyncStatus(ghost);
        },
        /** 向人格的依赖列表追加新依赖项，用于动态扩展人格能力 */
        addDependency: (dep: string) => {
            const ghost = state.ghosts.get(name);
            // 已注册人格才能添加依赖
            if (ghost) {
                ghost.core.meta.dependencies.push(dep);
            }
        },
        /** 返回personaStates中保存的快照，用于状态恢复和调试 */
        createSnapshot: () => state.personaStates.get(name) ?? null,
    };
}

/**
 * 重新平衡人格特质
 * @description 将人格拆分为情感/逻辑两部分后重新合并，恢复特质平衡，并保存状态快照
 * @param state - NERV内部状态
 * @param name - 人格名称
 */
export async function rebalancePersona(state: NERVState, name: string): Promise<void> {
    const ghost = state.ghosts.get(name);
    // 未注册人格跳过再平衡
    if (!ghost) {
        return;
    }
    const parts = splitPersona(ghost.core.Persona);
    const emotional = parts[0];
    const logical = parts[1];
    // splitPersona至少返回原始特质本身，但防御性检查避免undefined
    if (emotional && logical) {
        ghost.core.Persona = mergePersonaTraits(emotional, logical);
    }
    await savePersonaState(state, name);
    // 触发回调通知再平衡完成
    if (state.callbacks.onPersonaRebalanced) {
        state.callbacks.onPersonaRebalanced({ name });
    }
}
