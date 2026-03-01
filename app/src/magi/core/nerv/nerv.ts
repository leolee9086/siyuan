/** @fileoverview NERV人格管理系统工厂函数 — 闭包模式替代原始EventEmitter类 */

import type {
    NERVCallbacks,
    NERVExecutionResult,
    NERVGhost,
} from "../core.types";
import type { ActivationReport, NERVInstance, NERVState, PersonaAPI } from "./nerv.types";
import { createGhost } from "../dummySys/dummySys";
import { extractStringArray } from "../configLoader.guard";
import { calculateSyncStatus, selectPersonaVariant, splitPersona, mergeWorkflowResults } from "./nerv.helpers";
import {
    applyPersonaFilter,
    executeWithPersona,
    generateActivationReport,
    rebalancePersona,
    savePersonaState,
    wrapPersonaAPI,
} from "./nerv.ops";

/** 人格过期判定阈值（毫秒，1小时） */
const LIFECYCLE_EXPIRY_MS = 3600000;

/** 生命周期检查间隔（毫秒，1分钟） */
const LIFECYCLE_CHECK_INTERVAL = 60000;

/** 默认协同工作流顺序 */
const DEFAULT_WORKFLOW = ["Melchior", "Balthazar", "Casper"];

/**
 * 处理单个Ghost的生命周期检查
 * @description 判断未激活且超时的Ghost，执行停用和清理。由manageLifecycle定时器调用。
 * @param state - NERV内部状态
 * @param ghost - Ghost容器
 * @param name - 人格名称
 */
/** @同步豁免: 性能考虑 - 纯时间比较和状态判断，无I/O */
function checkLifecycleEntry(state: NERVState, ghost: NERVGhost, name: string): void {
    const lastActive = ghost.lastUsed ?? ghost.core.meta.created;
    const inactiveTime = Date.now() - lastActive;
    // 未激活且超过1小时的人格将被清理
    if (ghost.activationCount === 0 && inactiveTime > LIFECYCLE_EXPIRY_MS) {
        ghost.state = "inactive";
        state.activeStack = state.activeStack.filter((p) => p.name !== name);
        state.ghosts.delete(name);
        // 通知外部人格已过期
        state.callbacks.onPersonaExpired?.({ name, inactiveTime });
    }
}

/**
 * 内部人格激活逻辑
 * @description 从Ghost获取人格特质，分裂后按模式选择变体，更新激活栈和状态
 * @param state - NERV内部状态
 * @param name - 人格名称
 * @param mode - 激活模式（emotional/logical/balanced）
 * @param priority - 优先级
 */
async function activatePersonaInternal(
    state: NERVState,
    name: string,
    mode: string,
    priority: number
): Promise<ActivationReport> {
    const ghost = state.ghosts.get(name);
    // 未注册人格抛出错误
    if (!ghost) {
        throw new Error(`人格${name}未注册`);
    }
    const parts = splitPersona(ghost.core.Persona);
    const emotional = parts[0] ?? ghost.core.Persona;
    const logical = parts[1] ?? ghost.core.Persona;
    const persona = selectPersonaVariant(mode, emotional, logical);
    // 移除已有同名条目后重新入栈
    state.activeStack = state.activeStack.filter((p) => p.name !== name);
    state.activeStack.push({ name, persona, priority, activated: Date.now() });
    // 按优先级降序排列
    state.activeStack.sort((a, b) => b.priority - a.priority);
    ghost.state = "active";
    ghost.activationCount++;
    ghost.lastUsed = Date.now();
    const report = await generateActivationReport(state, name);
    state.callbacks.onPersonaActivated?.({ name, mode, report });
    return report;
}

/**
 * 执行协同工作流中的单个步骤
 * @description 解析人格名称和模式，按需激活人格，执行任务并应用过滤器
 * @param state - NERV内部状态
 * @param personaEntry - 工作流条目（格式: "Name" 或 "Name#mode"）
 * @param task - 待执行任务
 * @param context - 工作流上下文（含previousResults和workflowPosition）
 */
async function processWorkflowStep(
    state: NERVState,
    personaEntry: string,
    task: unknown,
    context: { previousResults: Array<{ persona: string; result: NERVExecutionResult }>; workflowPosition: number }
): Promise<{ persona: string; result: NERVExecutionResult; terminate: boolean; terminateReason: string | undefined }> {
    const hashIndex = personaEntry.indexOf("#");
    const name = hashIndex >= 0 ? personaEntry.substring(0, hashIndex) : personaEntry;
    const mode = hashIndex >= 0 ? personaEntry.substring(hashIndex + 1) : null;
    // 带模式标记的人格需要先激活
    if (mode) {
        await activatePersonaInternal(state, name, mode, 5);
    }
    const result = await executeWithPersona(state, name, task, context);
    context.previousResults.push({ persona: name, result });
    const filtered = applyPersonaFilter(name, result);
    const terminate = !!result.terminate;
    const terminateReason = terminate ? (result.terminateReason ?? "") : undefined;
    return { persona: name, result: filtered, terminate, terminateReason };
}

/**
 * 同步监控定时器回调
 * @description 遍历激活栈检查同步状态，对失同步的人格执行再平衡
 * @param state - NERV内部状态
 */
async function runSyncCheck(state: NERVState): Promise<void> {
    for (const entry of state.activeStack) {
        const ghost = state.ghosts.get(entry.name);
        // 跳过已被清理的Ghost
        if (!ghost) {
            continue;
        }
        const syncStatus = calculateSyncStatus(ghost);
        state.callbacks.onSyncUpdate?.({ name: entry.name, ...syncStatus });
        // 失同步时触发再平衡
        if (syncStatus.status === "desynced") {
            await rebalancePersona(state, entry.name);
        }
    }
}

/**
 * 生命周期定时器回调
 * @description 遍历所有Ghost执行过期检查
 * @param state - NERV内部状态
 */
/** @同步豁免: 性能考虑 - 纯状态遍历和时间比较，无I/O */
function runLifecycleCheck(state: NERVState): void {
    const entries = Array.from(state.ghosts.entries());
    for (const [name, ghost] of entries) {
        checkLifecycleEntry(state, ghost, name);
    }
}

/**
 * 协同处理内部实现
 * @description 按工作流顺序执行各人格任务，支持中途终止，最终合并结果
 * @param state - NERV内部状态
 * @param task - 待处理任务
 * @param config - 工作流配置（可指定workflow数组）
 */
async function collaborativeProcessInternal(
    state: NERVState,
    task: unknown,
    config: Record<string, unknown>
): Promise<import("../core.types").NERVWorkflowResult> {
    const workflowRaw = config["workflow"];
    const workflow = Array.isArray(workflowRaw) ? extractStringArray(workflowRaw) : DEFAULT_WORKFLOW;
    const results: Array<{ persona: string; result: NERVExecutionResult }> = [];
    const previousResults: Array<{ persona: string; result: NERVExecutionResult }> = [];
    const context = { startTime: Date.now(), previousResults, workflowPosition: 0 };

    for (let i = 0; i < workflow.length; i++) {
        const entry = workflow[i];
        // extractStringArray保证元素为string，但TS数组索引仍可能为undefined
        if (!entry) {
            continue;
        }
        context.workflowPosition = i;
        const step = await processWorkflowStep(state, entry, task, context);
        results.push({ persona: step.persona, result: step.result });
        // 人格请求终止工作流时提前退出
        if (step.terminate) {
            state.callbacks.onWorkflowTerminated?.({ name: step.persona, reason: step.terminateReason, position: i });
            break;
        }
    }

    const merged = mergeWorkflowResults(results);
    state.callbacks.onWorkflowCompleted?.({ task, results: merged, executionTime: Date.now() - context.startTime });
    return merged;
}

/**
 * 创建人格内部实现
 * @description 验证名称、检查重复、调用DummySys创建Ghost、存入状态并返回API
 * @param state - NERV内部状态
 * @param name - 人格名称
 * @param traits - 人格特质配置
 * @param config - 额外配置（含dependencies等）
 */
async function createPersonaInternal(
    state: NERVState,
    name: string,
    traits: Record<string, unknown>,
    config: Record<string, unknown>
): Promise<PersonaAPI> {
    // 名称校验
    if (!name || typeof name !== "string") {
        throw new Error("人格名称无效");
    }
    // 重复检查
    if (state.ghosts.has(name)) {
        throw new Error(`人格${name}已存在`);
    }
    const dependencies = extractStringArray(config["dependencies"] ?? []);
    // dependencies放在顶层——createGhost内部从personaOverrides["dependencies"]读取
    const ghost = await createGhost(name, { ...traits, dependencies });
    state.ghosts.set(name, { core: ghost, state: "inactive", activationCount: 0, lastUsed: null, config });
    state.callbacks.onPersonaCreated?.({ name, traits });
    return wrapPersonaAPI(state, name);
}

/**
 * 停用人格内部实现
 * @description 将Ghost状态设为inactive，从激活栈移除，保存状态快照
 * @param state - NERV内部状态
 * @param name - 人格名称
 */
async function deactivatePersonaInternal(state: NERVState, name: string): Promise<void> {
    const ghost = state.ghosts.get(name);
    // 未注册人格跳过停用
    if (!ghost) {
        return;
    }
    ghost.state = "inactive";
    state.activeStack = state.activeStack.filter((p) => p.name !== name);
    await savePersonaState(state, name);
    state.callbacks.onPersonaDeactivated?.({ name });
}

/**
 * 创建NERV人格管理系统实例
 * @description 初始化内部状态，返回NERVInstance接口。
 *   替代原始JS的 `new NERV()` + EventEmitter模式，使用回调替代事件。
 * @param callbacks - 事件回调集合（替代EventEmitter的on/emit）
 */
export async function createNERV(callbacks: NERVCallbacks = {}): Promise<NERVInstance> {
    const state: NERVState = {
        ghosts: new Map(),
        activeStack: [],
        personaStates: new Map(),
        callbacks,
        syncMonitor: null,
        lifecycleTimer: null,
    };

    return {
        /** 创建新人格并返回其API */
        createPersona: (name, traits, config = {}) => createPersonaInternal(state, name, traits, config),
        /** 激活指定人格（支持emotional/logical/balanced模式） */
        activatePersona: (name, mode = "balanced", priority = 5) => activatePersonaInternal(state, name, mode, priority),
        /** 停用指定人格 */
        deactivatePersona: (name) => deactivatePersonaInternal(state, name),
        /** 按工作流顺序协同处理任务 */
        collaborativeProcess: (task, config = {}) => collaborativeProcessInternal(state, task, config),
        /** 启动同步率监控定时器 */
        startSyncMonitoring: (interval = 5000) => {
            // 清理已有监控避免重复
            if (state.syncMonitor) {
                clearInterval(state.syncMonitor);
            }
            // setInterval: 同步率监控需要周期性轮询所有活跃人格的状态，
            // 无法使用事件驱动——人格执行由外部触发，内部无法预知时机。
            // interval由调用者根据系统负载决定，默认5秒。
            state.syncMonitor = setInterval(() => {
                runSyncCheck(state);
            }, interval);
        },
        /** 停止同步率监控 */
        stopSyncMonitoring: () => {
            // 仅在监控运行时清理
            if (state.syncMonitor) {
                clearInterval(state.syncMonitor);
                state.syncMonitor = null;
            }
        },
        /** 启动人格生命周期管理定时器 */
        manageLifecycle: () => {
            // 清理已有定时器避免重复
            if (state.lifecycleTimer) {
                clearInterval(state.lifecycleTimer);
            }
            // setInterval: 生命周期管理需要定期扫描所有Ghost检测过期，
            // Ghost创建/销毁时机不可预知，只能通过轮询实现。
            // 间隔60秒，与原始JS实现一致。
            state.lifecycleTimer = setInterval(() => {
                runLifecycleCheck(state);
            }, LIFECYCLE_CHECK_INTERVAL);
        },
        /** 停止生命周期管理 */
        stopLifecycle: () => {
            // 仅在定时器运行时清理
            if (state.lifecycleTimer) {
                clearInterval(state.lifecycleTimer);
                state.lifecycleTimer = null;
            }
        },
    };
}
