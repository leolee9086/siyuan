/**
 * @fileoverview NERV系统实例类型定义
 * @description 定义NERV人格管理系统的激活栈、报告、API和实例接口。
 *   从core.types.ts分离以遵守300行文件限制。
 */

import type {
    NERVCallbacks,
    NERVExecutionResult,
    NERVGhost,
    NERVSyncStatus,
    NERVWorkflowResult,
    PersonaTraits,
} from "../core.types";

/** NERV激活栈条目 */
export interface ActiveStackEntry {
    name: string;
    persona: PersonaTraits;
    priority: number;
    activated: number;
}

/** NERV激活报告 */
export interface ActivationReport {
    name: string;
    state: "inactive" | "active";
    activations: number;
    lastUsed: number | null;
    syncStatus: NERVSyncStatus;
}

/** NERV内部状态容器（传递给模块级操作函数） */
export interface NERVState {
    ghosts: Map<string, NERVGhost>;
    activeStack: ActiveStackEntry[];
    personaStates: Map<string, Record<string, unknown>>;
    callbacks: NERVCallbacks;
    syncMonitor: ReturnType<typeof setInterval> | null;
    lifecycleTimer: ReturnType<typeof setInterval> | null;
}

/** NERV人格API（createPersona返回值） */
export interface PersonaAPI {
    execute: (task: unknown) => Promise<NERVExecutionResult>;
    getStatus: () => NERVSyncStatus;
    addDependency: (dep: string) => void;
    createSnapshot: () => Record<string, unknown> | null;
}

/** NERV系统实例 */
export interface NERVInstance {
    createPersona: (name: string, traits: Record<string, unknown>, config?: Record<string, unknown>) => Promise<PersonaAPI>;
    activatePersona: (name: string, mode?: string, priority?: number) => Promise<ActivationReport>;
    deactivatePersona: (name: string) => Promise<void>;
    collaborativeProcess: (task: unknown, config?: Record<string, unknown>) => Promise<NERVWorkflowResult>;
    startSyncMonitoring: (interval?: number) => void;
    stopSyncMonitoring: () => void;
    manageLifecycle: () => void;
    stopLifecycle: () => void;
}
