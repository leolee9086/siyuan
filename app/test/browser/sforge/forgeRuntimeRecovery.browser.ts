import {describe, expect, it} from "vitest";
import {createForgeRuntimeRecoveryURL} from "../../../src/sforge/forgeRuntime/exitContinuity";

const waitUntil = async (predicate: () => boolean, timeout = 3_000) => {
    const deadline = Date.now() + timeout;
    while (!predicate()) {
        if (Date.now() >= deadline) {
            throw new Error("Timed out waiting for Forge Runtime recovery state");
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
};

const mountRecoveryFrame = async (jobId: string, targetRevision: string, returnPath: string) => {
    const returnURL = new URL(returnPath, window.location.origin).href;
    const recoveryURL = createForgeRuntimeRecoveryURL({
        mode: "forge-restart",
        jobId,
        targetRevision,
    }, returnURL);
    if (!recoveryURL) {
        throw new Error("Forge Runtime recovery URL was not created");
    }
    const frame = document.createElement("iframe");
    frame.src = recoveryURL;
    const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), {once: true}));
    document.body.append(frame);
    await loaded;
    const recoveryWindow = frame.contentWindow;
    if (!recoveryWindow) {
        throw new Error("Forge Runtime recovery frame did not expose its window");
    }
    return {
        frame,
        recoveryURL,
        recoveryWindow,
        returnURL,
        cleanup: () => {
            frame.remove();
            URL.revokeObjectURL(recoveryURL);
        },
    };
};

describe("Forge Runtime recovery document", () => {
    it("stays isolated for a mismatched job and resumes only after the exact healthy revision", async () => {
        const jobId = "restart-job-browser";
        const targetRevision = "a".repeat(40);
        const {cleanup, frame, recoveryWindow, returnURL} = await mountRecoveryFrame(
            jobId,
            targetRevision,
            "/__forge-runtime-recovered__",
        );
        expect(Reflect.get(recoveryWindow, "siyuan")).toBeUndefined();

        let matching = false;
        let requestCount = 0;
        Object.defineProperty(recoveryWindow, "fetch", {
            configurable: true,
            value: async () => {
                requestCount += 1;
                return new Response(JSON.stringify({
                    code: 0,
                    msg: "",
                    data: {
                        available: true,
                        status: {
                            lifecycle: "ready",
                            ready: true,
                            activeVersion: {revision: targetRevision, state: "healthy"},
                            job: {id: matching ? jobId : "another-job", state: "completed", phase: "completed"},
                        },
                    },
                }), {status: 200, headers: {"Content-Type": "application/json"}});
            },
        });

        await waitUntil(() => requestCount > 0);
        expect(recoveryWindow.location.protocol).toBe("blob:");
        expect(frame.contentDocument?.body.textContent).toContain("对应的切换任务");

        matching = true;
        await waitUntil(() => recoveryWindow.location.href === returnURL);

        cleanup();
    });

    it("keeps a failed candidate isolated even if a healthy version is active", async () => {
        const jobId = "restart-job-failed";
        const targetRevision = "b".repeat(40);
        const {cleanup, frame, recoveryWindow} = await mountRecoveryFrame(
            jobId,
            targetRevision,
            "/__forge-runtime-failed__",
        );
        Object.defineProperty(recoveryWindow, "fetch", {
            configurable: true,
            value: async () => new Response(JSON.stringify({
                code: 0,
                msg: "",
                data: {
                    available: true,
                    status: {
                        activeVersion: {revision: targetRevision, state: "healthy"},
                        job: {id: jobId, state: "failed", phase: "failed", error: "candidate rejected"},
                    },
                },
            }), {status: 200, headers: {"Content-Type": "application/json"}}),
        });

        await waitUntil(() => frame.contentDocument?.body.textContent?.includes("更新失败") === true);
        expect(recoveryWindow.location.protocol).toBe("blob:");
        expect(frame.contentDocument?.getElementById("resumeRollback")?.style.display).toBe("");

        cleanup();
    });

    it("offers manual resume only after the rollback version is healthy", async () => {
        const jobId = "restart-job-rollback";
        const targetRevision = "c".repeat(40);
        const rollbackRevision = "d".repeat(40);
        const {cleanup, frame, recoveryWindow, returnURL} = await mountRecoveryFrame(
            jobId,
            targetRevision,
            "/__forge-runtime-rollback__",
        );
        let rollbackHealthy = false;
        Object.defineProperty(recoveryWindow, "fetch", {
            configurable: true,
            value: async () => new Response(JSON.stringify({
                code: 0,
                msg: "",
                data: {
                    available: true,
                    status: {
                        lifecycle: "ready",
                        ready: true,
                        activeVersion: {revision: rollbackRevision, state: rollbackHealthy ? "healthy" : "starting"},
                        job: {id: jobId, state: "rolled_back", phase: "rollback", error: "candidate unhealthy"},
                    },
                },
            }), {status: 200, headers: {"Content-Type": "application/json"}}),
        });

        await waitUntil(() => frame.contentDocument?.body.textContent?.includes("已恢复上一健康版本") === true);
        const resumeButton = frame.contentDocument?.getElementById("resumeRollback") as HTMLButtonElement | null;
        expect(resumeButton?.style.display).toBe("");
        expect(recoveryWindow.location.protocol).toBe("blob:");

        rollbackHealthy = true;
        await waitUntil(() => resumeButton?.style.display === "inline-block");
        resumeButton?.click();
        await waitUntil(() => recoveryWindow.location.href === returnURL);

        cleanup();
    });
});
