import {ForgeRuntimeClient} from "./client";
import {isForgeRuntimeElectronRestartActive} from "./restartState";
import {isForgeRuntimeJobActive} from "./types";
import type {ForgeRuntimeControllerState, ForgeRuntimeStatusData} from "./types";

type ForgeRuntimeStateListener = (state: ForgeRuntimeControllerState) => void;

const activePollInterval = 1000;
const idlePollInterval = 5000;

export class ForgeRuntimeController {
    private readonly listeners = new Set<ForgeRuntimeStateListener>();
    private readonly client: ForgeRuntimeClient;
    private currentState: ForgeRuntimeControllerState = {status: undefined, busy: false, error: undefined};
    private refreshPromise: Promise<ForgeRuntimeStatusData> | undefined;
    private pollTimer: number | undefined;
    private started = false;
    private destroyed = false;
    private pollingSuspended = false;

    constructor(client = new ForgeRuntimeClient()) {
        this.client = client;
    }

    public get state(): ForgeRuntimeControllerState {
        return {...this.currentState};
    }

    public subscribe(listener: ForgeRuntimeStateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    public async start(): Promise<ForgeRuntimeStatusData> {
        if (this.destroyed) {
            throw new Error("Forge Runtime controller has been destroyed");
        }
        if (this.started && this.currentState.status) {
            return this.currentState.status;
        }
        this.started = true;
        if (this.pollingSuspended || isForgeRuntimeElectronRestartActive()) {
            return this.currentState.status ?? {available: false};
        }
        try {
            return await this.refresh();
        } finally {
            this.schedulePoll();
        }
    }

    public async refresh(): Promise<ForgeRuntimeStatusData> {
        if (this.destroyed) {
            throw new Error("Forge Runtime controller has been destroyed");
        }
        if (this.refreshPromise) {
            return await this.refreshPromise;
        }
        this.refreshPromise = this.loadStatus();
        try {
            return await this.refreshPromise;
        } finally {
            this.refreshPromise = undefined;
        }
    }

    public async restart(reason: string): Promise<void> {
        const normalizedReason = reason.trim();
        if (!normalizedReason) {
            throw new Error("Forge Runtime restart reason is required");
        }
        if (isForgeRuntimeJobActive(this.currentState.status?.status?.job)) {
            throw new Error("A Forge Runtime restart job is already running");
        }
        if (this.pollingSuspended || isForgeRuntimeElectronRestartActive()) {
            throw new Error("Forge Runtime is waiting for Kernel replacement");
        }
        await this.runMutation(async () => {
            await this.client.restart(normalizedReason);
        });
    }

    public async approveProtectedTests(jobId: string, revision: string): Promise<void> {
        await this.runMutation(async () => {
            await this.client.approveProtectedTests(jobId, revision);
        });
    }

    public async rejectProtectedTests(jobId: string, revision: string): Promise<void> {
        await this.runMutation(async () => {
            await this.client.rejectProtectedTests(jobId, revision);
        });
    }

    public destroy(): void {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        this.pollingSuspended = true;
        if (this.pollTimer !== undefined) {
            window.clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
        this.listeners.clear();
    }

    /** 暂停热替换期间的控制面轮询，避免把停机窗口当成鉴权或业务错误。 */
    public pauseForKernelRestart(): void {
        this.pollingSuspended = true;
        if (this.pollTimer !== undefined) {
            window.clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
        if (this.currentState.error) {
            this.currentState = {...this.currentState, error: undefined};
            this.emit();
        }
    }

    /** 在 Kernel 恢复或回滚后恢复控制面轮询。 */
    public resumeAfterKernelRestart(): void {
        if (this.destroyed) {
            return;
        }
        this.pollingSuspended = false;
        if (this.currentState.status?.available === false) {
            this.currentState = {...this.currentState, status: undefined, error: undefined};
            this.emit();
        }
        this.schedulePoll();
    }

    private async loadStatus(): Promise<ForgeRuntimeStatusData> {
        try {
            const status = await this.client.getStatus();
            if (this.pollingSuspended || isForgeRuntimeElectronRestartActive()) {
                return this.currentState.status ?? status;
            }
            this.currentState = {...this.currentState, status, error: undefined};
            this.emit();
            return status;
        } catch (error) {
            if (this.pollingSuspended || isForgeRuntimeElectronRestartActive()) {
                this.currentState = {...this.currentState, error: undefined};
                this.emit();
                return this.currentState.status ?? {available: false};
            }
            const statusError = error instanceof Error ? error : new Error(String(error));
            this.currentState = {...this.currentState, error: statusError};
            this.emit();
            throw statusError;
        }
    }

    private async runMutation(operation: () => Promise<void>): Promise<void> {
        if (this.destroyed) {
            throw new Error("Forge Runtime controller has been destroyed");
        }
        if (this.currentState.busy) {
            throw new Error("A Forge Runtime control request is already running");
        }
        this.currentState = {...this.currentState, busy: true, error: undefined};
        this.emit();
        try {
            await operation();
            await this.refresh();
        } catch (error) {
            const operationError = error instanceof Error ? error : new Error(String(error));
            this.currentState = {...this.currentState, error: operationError};
            this.emit();
            throw operationError;
        } finally {
            this.currentState = {...this.currentState, busy: false};
            this.emit();
            this.schedulePoll();
        }
    }

    private schedulePoll(): void {
        if (this.destroyed || this.pollingSuspended || isForgeRuntimeElectronRestartActive() || !this.started ||
            this.currentState.status?.available === false) {
            return;
        }
        if (this.pollTimer !== undefined) {
            window.clearTimeout(this.pollTimer);
        }
        const interval = isForgeRuntimeJobActive(this.currentState.status?.status?.job) ?
            activePollInterval : idlePollInterval;
        this.pollTimer = window.setTimeout(() => {
            this.pollTimer = undefined;
            void this.refresh().catch((error) => {
                console.error("[Forge Runtime] 状态轮询失败", error);
            }).finally(() => this.schedulePoll());
        }, interval);
    }

    private emit(): void {
        const state = this.state;
        for (const listener of this.listeners) {
            listener(state);
        }
    }
}
