import {afterEach, describe, expect, it, vi} from "vitest";
import {
    createForgeRuntimeElectronReloadURL,
    reloadForgeRuntimeElectronInterface,
    startForgeRuntimeElectronContinuity,
} from "../../src/sforge/forgeRuntime/electronContinuity";
import {
    getForgeRuntimeElectronRestartState,
    isForgeRuntimeElectronRestartActive,
} from "../../src/sforge/forgeRuntime/restartState";

const targetRevision = "a".repeat(40);
const previousRevision = "b".repeat(40);
const context = {
    mode: "forge-restart" as const,
    jobId: "restart-job-1",
    targetRevision,
};

const statusPayload = ({
    activeVersion = {id: "version-1", revision: targetRevision, state: "healthy"},
    job = {id: context.jobId, state: "completed", phase: "completed", reason: "", error: ""},
    lifecycle = "ready",
    ready = true,
}: Record<string, unknown> = {}) => ({
    code: 0,
    msg: "",
    data: {
        available: true,
        status: {
            mode: "forge-source-supervisor",
            lifecycle,
            ready,
            processId: 100,
            port: 6806,
            activeVersion,
            job,
            retainedVersions: [],
        },
    },
});

const response = (payload: unknown, status = 200): Response => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
} as Response);

describe("Forge Runtime Electron continuity", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        const state = getForgeRuntimeElectronRestartState();
        state.active = false;
        state.context = undefined;
        state.promise = undefined;
        expect(isForgeRuntimeElectronRestartActive()).toBe(false);
    });

    it("refreshes the Electron main interface with a cache-busted URL", () => {
        expect(createForgeRuntimeElectronReloadURL(
            "https://127.0.0.1:6806/stage/build/app/?v=1#workspace",
            42,
        )).toBe("https://127.0.0.1:6806/stage/build/app/?v=42#workspace");

        const replace = vi.fn();
        const reload = vi.fn();
        reloadForgeRuntimeElectronInterface({
            href: "https://127.0.0.1:6806/stage/build/app/?v=1",
            replace,
            reload,
        }, 43);
        expect(replace).toHaveBeenCalledWith("https://127.0.0.1:6806/stage/build/app/?v=43");
        expect(reload).not.toHaveBeenCalled();
    });

    it("falls back to a native reload when cache-busted navigation fails", () => {
        const replace = vi.fn(() => {
            throw new Error("navigation blocked");
        });
        const reload = vi.fn();
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

        reloadForgeRuntimeElectronInterface({
            href: "https://127.0.0.1:6806/stage/build/app/",
            replace,
            reload,
        }, 44);

        expect(replace).toHaveBeenCalledOnce();
        expect(reload).toHaveBeenCalledOnce();
        expect(errorLog).toHaveBeenCalledWith("[Forge Runtime] Electron 主界面自动刷新失败", expect.any(Error));
    });

    it("leaves ordinary exits outside the Electron continuity state machine", () => {
        expect(startForgeRuntimeElectronContinuity(undefined)).toBeUndefined();
        expect(isForgeRuntimeElectronRestartActive()).toBe(false);
    });

    it("reloads only after the matching job, healthy target and Supervisor readiness are confirmed", async () => {
        let now = 0;
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(response(statusPayload({ready: false})))
            .mockResolvedValueOnce(response(statusPayload()));

        const result = await startForgeRuntimeElectronContinuity(context, {
            fetchImpl,
            delay: async () => {
                now += 1;
            },
            now: () => now,
            intervalMilliseconds: 1,
            timeoutMilliseconds: 10,
        });

        expect(result).toEqual({state: "completed", revision: targetRevision});
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(fetchImpl).toHaveBeenNthCalledWith(1, "/api/s-forge/forge/runtime/status", expect.objectContaining({
            method: "POST",
            credentials: "same-origin",
            body: "{}",
        }));
    });

    it("fails closed on a completed job whose active revision does not match", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(response(statusPayload({
            activeVersion: {
                id: "version-old",
                revision: previousRevision,
                state: "healthy",
            },
        })));

        await expect(startForgeRuntimeElectronContinuity(context, {
            fetchImpl,
            delay: async () => undefined,
            now: () => 0,
            intervalMilliseconds: 1,
            timeoutMilliseconds: 10,
        })).resolves.toEqual({
            state: "rejected",
            detail: "活动 Kernel revision 与已验证目标不匹配",
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it("waits for a stable rollback and never reports it as a reload", async () => {
        let now = 0;
        const rollbackJob = {
            id: context.jobId,
            state: "rolled_back",
            phase: "rollback",
            reason: "",
            error: "candidate unhealthy",
        };
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(response(statusPayload({
                activeVersion: {id: "version-old", revision: previousRevision, state: "starting"},
                job: rollbackJob,
                ready: false,
            })))
            .mockResolvedValueOnce(response(statusPayload({
                activeVersion: {id: "version-old", revision: previousRevision, state: "healthy"},
                job: rollbackJob,
            })));

        await expect(startForgeRuntimeElectronContinuity(context, {
            fetchImpl,
            delay: async () => {
                now += 1;
            },
            now: () => now,
            intervalMilliseconds: 1,
            timeoutMilliseconds: 10,
        })).resolves.toEqual({
            state: "rolled_back",
            revision: previousRevision,
            detail: "candidate unhealthy",
        });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("retries a disconnected status endpoint and rejects a permanent control error", async () => {
        let now = 0;
        const fetchImpl = vi.fn()
            .mockRejectedValueOnce(new Error("fetch failed"))
            .mockResolvedValueOnce(response({code: -1, msg: "Forge Runtime 控制仅允许 Kernel 同设备 WebUI 访问", data: null}));

        await expect(startForgeRuntimeElectronContinuity(context, {
            fetchImpl,
            delay: async () => {
                now += 1;
            },
            now: () => now,
            intervalMilliseconds: 1,
            timeoutMilliseconds: 10,
        })).resolves.toEqual({
            state: "rejected",
            detail: "Forge Runtime 控制仅允许 Kernel 同设备 WebUI 访问",
        });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("keeps waiting while the Kernel capability is temporarily unavailable", async () => {
        let now = 0;
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(response({...statusPayload(), data: {available: false}}))
            .mockResolvedValueOnce(response(statusPayload()));
        const result = await startForgeRuntimeElectronContinuity(context, {
            fetchImpl,
            delay: async () => {
                now += 1;
            },
            now: () => now,
            intervalMilliseconds: 1,
            timeoutMilliseconds: 10,
        });
        expect(result).toEqual({state: "completed", revision: targetRevision});
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("times out without treating an unstable endpoint as a successful restart", async () => {
        let now = 0;
        const fetchImpl = vi.fn().mockResolvedValue(response({error: "starting"}, 503));

        await expect(startForgeRuntimeElectronContinuity(context, {
            fetchImpl,
            delay: async () => {
                now += 1;
            },
            now: () => now,
            intervalMilliseconds: 1,
            timeoutMilliseconds: 3,
        })).resolves.toEqual({state: "timed_out", detail: "等待已验证 Kernel 超时"});
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it("deduplicates the same event and isolates a different task identity", async () => {
        let resolveFetch: (value: Response) => void = () => undefined;
        const fetchImpl = vi.fn().mockReturnValue(new Promise<Response>((resolve) => {
            resolveFetch = resolve;
        }));
        const first = startForgeRuntimeElectronContinuity(context, {fetchImpl});
        const duplicate = startForgeRuntimeElectronContinuity({...context}, {fetchImpl});
        const other = startForgeRuntimeElectronContinuity({...context, jobId: "other-job"}, {fetchImpl});

        expect(duplicate).toBe(first);
        expect(isForgeRuntimeElectronRestartActive()).toBe(true);
        expect(other).toBeUndefined();
        expect(fetchImpl).toHaveBeenCalledOnce();
        resolveFetch(response(statusPayload()));
        await expect(first).resolves.toEqual({state: "completed", revision: targetRevision});
        expect(getForgeRuntimeElectronRestartState().promise).toBeUndefined();
    });

    it("returns a terminal rejection for a malformed structured event", async () => {
        await expect(startForgeRuntimeElectronContinuity({mode: "forge-restart"})).resolves.toMatchObject({
            state: "rejected",
        });
        expect(isForgeRuntimeElectronRestartActive()).toBe(false);
    });
});
