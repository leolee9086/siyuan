import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const network = vi.hoisted(() => ({
    fetchSyncPost: vi.fn(),
}));

vi.mock("../../src/util/network/fetch", () => ({
    fetchSyncPost: network.fetchSyncPost,
}));

import {ForgeRuntimeClient} from "../../src/sforge/forgeRuntime/client";
import {ForgeRuntimeController} from "../../src/sforge/forgeRuntime/controller";
import {
    forgeRuntimeStatusDataSchema,
    getForgeProtectedApprovalKey,
} from "../../src/sforge/forgeRuntime/types";
import type {ForgeRuntimeRestartResponse, ForgeRuntimeStatusData} from "../../src/sforge/forgeRuntime/types";
const version = {
    id: "version-1",
    revision: "revision-1",
    state: "healthy",
};

type ForgeRuntimeStatusJob = NonNullable<ForgeRuntimeStatusData["status"]>["job"];

const status = (job: ForgeRuntimeStatusJob = null): ForgeRuntimeStatusData => ({
    available: true,
    status: {
        mode: "forge-source-supervisor",
        processId: 100,
        port: 6806,
        activeVersion: version,
        job,
        retainedVersions: [version],
    },
});

const activeJob = {
    id: "job-1",
    state: "running",
    phase: "core_tests",
    reason: "manual validation",
    error: "",
};

const completedJob = {
    ...activeJob,
    state: "completed",
    phase: "completed",
};

describe("Forge Runtime WebUI client", () => {
    beforeEach(() => {
        network.fetchSyncPost.mockReset();
    });

    it("validates the Supervisor status contract", () => {
        expect(forgeRuntimeStatusDataSchema.parse(status(activeJob))).toEqual(status(activeJob));
        expect(() => forgeRuntimeStatusDataSchema.parse({available: true, status: {mode: "other"}})).toThrow();
    });

    it("sends exact JSON requests without exposing Supervisor credentials", async () => {
        const client = new ForgeRuntimeClient();
        network.fetchSyncPost
            .mockResolvedValueOnce({code: 0, msg: "", data: {job: activeJob}})
            .mockResolvedValueOnce({
                code: 0,
                msg: "",
                data: {approval: {jobId: "job-1", revision: "revision-1", state: "approved"}},
            })
            .mockResolvedValueOnce({
                code: 0,
                msg: "",
                data: {approval: {jobId: "job-1", revision: "revision-1", state: "rejected"}},
            });

        await client.restart("manual validation");
        await client.approveProtectedTests("job-1", "revision-1");
        await client.rejectProtectedTests("job-1", "revision-1");

        const headers = {"Content-Type": "application/json"};
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(1,
            "/api/s-forge/forge/runtime/restart", {reason: "manual validation"}, headers);
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(2,
            "/api/s-forge/forge/runtime/approveProtectedTests", {jobId: "job-1", revision: "revision-1"}, headers);
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(3,
            "/api/s-forge/forge/runtime/rejectProtectedTests", {jobId: "job-1", revision: "revision-1"}, headers);
        expect(JSON.stringify(network.fetchSyncPost.mock.calls)).not.toContain("supervisor-token");
    });

    it("reads status without routing transient control responses through the global message handler", async () => {
        network.fetchSyncPost.mockResolvedValue({code: 0, msg: "", data: status()});

        await expect(new ForgeRuntimeClient().getStatus()).resolves.toEqual(status());
        expect(network.fetchSyncPost).toHaveBeenCalledWith(
            "/api/s-forge/forge/runtime/status",
            {},
            {"Content-Type": "application/json"},
            {processMessage: false},
        );
    });

    it("reports a direct Forge launch without Supervisor as unavailable", async () => {
        network.fetchSyncPost.mockResolvedValue({code: -1, msg: "Forge Supervisor 控制面未连接", data: null});

        await expect(new ForgeRuntimeClient().getStatus()).resolves.toEqual({available: false});
    });

    it("surfaces Kernel API failures", async () => {
        network.fetchSyncPost.mockResolvedValue({code: -1, msg: "same-device WebUI required", data: null});

        await expect(new ForgeRuntimeClient().getStatus()).rejects.toThrow("same-device WebUI required");
    });
});

describe("Forge Runtime controller", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("coalesces concurrent status refreshes", async () => {
        const client = new ForgeRuntimeClient();
        let resolveStatus: (value: ForgeRuntimeStatusData) => void = () => undefined;
        const pendingStatus = new Promise<ForgeRuntimeStatusData>((resolve) => {
            resolveStatus = resolve;
        });
        const getStatus = vi.spyOn(client, "getStatus").mockReturnValue(pendingStatus);
        const controller = new ForgeRuntimeController(client);

        const first = controller.refresh();
        const second = controller.refresh();
        resolveStatus(status());

        await expect(first).resolves.toEqual(status());
        await expect(second).resolves.toEqual(status());
        expect(getStatus).toHaveBeenCalledOnce();
        controller.destroy();
    });

    it("locks concurrent mutations and immediately switches to active polling", async () => {
        const client = new ForgeRuntimeClient();
        const getStatus = vi.spyOn(client, "getStatus")
            .mockResolvedValueOnce(status())
            .mockResolvedValue(status(activeJob));
        let finishRestart: (value: ForgeRuntimeRestartResponse) => void = () => undefined;
        vi.spyOn(client, "restart").mockReturnValue(new Promise<ForgeRuntimeRestartResponse>((resolve) => {
            finishRestart = resolve;
        }));
        const controller = new ForgeRuntimeController(client);
        await controller.start();

        const restart = controller.restart("manual validation");
        await Promise.resolve();
        await expect(controller.restart("second request")).rejects.toThrow("already running");
        finishRestart({job: activeJob});
        await restart;
        expect(getStatus).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(999);
        expect(getStatus).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(getStatus).toHaveBeenCalledTimes(3);
        controller.destroy();
    });

    it("rejects a duplicate restart while the Supervisor job is active", async () => {
        const client = new ForgeRuntimeClient();
        vi.spyOn(client, "getStatus").mockResolvedValue(status(activeJob));
        const restart = vi.spyOn(client, "restart");
        const controller = new ForgeRuntimeController(client);
        await controller.start();

        await expect(controller.restart("duplicate request")).rejects.toThrow("restart job is already running");
        expect(restart).not.toHaveBeenCalled();
        controller.destroy();
    });

    it("allows a new restart after the previous Supervisor job reaches a terminal state", async () => {
        const client = new ForgeRuntimeClient();
        vi.spyOn(client, "getStatus").mockResolvedValue(status(completedJob));
        const restart = vi.spyOn(client, "restart").mockResolvedValue({job: activeJob});
        const controller = new ForgeRuntimeController(client);
        await controller.start();

        await controller.restart("next validated revision");

        expect(restart).toHaveBeenCalledOnce();
        expect(restart).toHaveBeenCalledWith("next validated revision");
        controller.destroy();
    });

    it("stops polling after destruction", async () => {
        const client = new ForgeRuntimeClient();
        const getStatus = vi.spyOn(client, "getStatus").mockResolvedValue(status());
        const controller = new ForgeRuntimeController(client);
        await controller.start();
        controller.destroy();

        await vi.advanceTimersByTimeAsync(10_000);
        expect(getStatus).toHaveBeenCalledOnce();
    });

    it("does not let a paused status response poison the state used after resume", async () => {
        const client = new ForgeRuntimeClient();
        const getStatus = vi.spyOn(client, "getStatus").mockResolvedValueOnce(status());
        const controller = new ForgeRuntimeController(client);
        await controller.start();

        let resolvePausedStatus: (value: ForgeRuntimeStatusData) => void = () => undefined;
        getStatus.mockReturnValueOnce(new Promise<ForgeRuntimeStatusData>((resolve) => {
            resolvePausedStatus = resolve;
        }));
        controller.pauseForKernelRestart();
        const refresh = controller.refresh();
        resolvePausedStatus({available: false});
        await expect(refresh).resolves.toEqual(status());

        expect(controller.state.status).toEqual(status());
        controller.resumeAfterKernelRestart();
        controller.destroy();
    });

    it("restarts polling when startup happens during a Kernel replacement", async () => {
        const client = new ForgeRuntimeClient();
        const getStatus = vi.spyOn(client, "getStatus").mockResolvedValue(status());
        const controller = new ForgeRuntimeController(client);

        controller.pauseForKernelRestart();
        await expect(controller.start()).resolves.toEqual({available: false});

        controller.resumeAfterKernelRestart();
        await vi.advanceTimersByTimeAsync(5000);

        expect(getStatus).toHaveBeenCalledOnce();
        controller.destroy();
    });

    it("binds protected approval identity to both job and revision", () => {
        const job = {
            ...activeJob,
            state: "awaiting_protected_test_approval",
            phase: "protected_test_approval",
            protectedTestApproval: {
                state: "pending" as const,
                revision: "revision-1",
                paths: ["kernel/api/forge_runtime_test.go"],
            },
        };

        expect(getForgeProtectedApprovalKey(job)).toBe("job-1\u0000revision-1");
        expect(getForgeProtectedApprovalKey({...job, id: "job-2"})).not.toBe(getForgeProtectedApprovalKey(job));
        expect(getForgeProtectedApprovalKey({...job, protectedTestApproval: {
            ...job.protectedTestApproval,
            revision: "revision-2",
        }})).not.toBe(getForgeProtectedApprovalKey(job));
    });
});
