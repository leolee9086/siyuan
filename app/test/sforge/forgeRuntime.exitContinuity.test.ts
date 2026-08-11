import {describe, expect, it, vi} from "vitest";
import {
    createForgeRuntimeRecoveryURL,
} from "../../src/sforge/forgeRuntime/exitContinuity";

const exitContext = {
    mode: "forge-restart" as const,
    jobId: "restart-job-1",
    targetRevision: "a".repeat(40),
};

describe("Forge Runtime browser continuity", () => {
    it("keeps ordinary exits on the non-recoverable path", () => {
        const createObjectURL = vi.fn();

        expect(createForgeRuntimeRecoveryURL(undefined, "http://localhost:6806/stage/build/desktop/", createObjectURL))
            .toBeUndefined();
        expect(createObjectURL).not.toHaveBeenCalled();
    });

    it("rejects forged recovery identities and unsafe return URLs", () => {
        expect(() => createForgeRuntimeRecoveryURL({...exitContext, targetRevision: "not-a-revision"},
            "http://localhost:6806/stage/build/desktop/")).toThrow();
        expect(() => createForgeRuntimeRecoveryURL({...exitContext, extra: true},
            "http://localhost:6806/stage/build/desktop/")).toThrow();
        expect(() => createForgeRuntimeRecoveryURL(exitContext,
            "http://localhost:6806/stage/build/desktop/?token=secret")).toThrow(/token query/);
        expect(() => createForgeRuntimeRecoveryURL(exitContext,
            "http://user:password@localhost:6806/stage/build/desktop/")).toThrow(/user information/);
    });

    it("builds an isolated same-origin recovery document without Supervisor credentials", async () => {
        let recoveryBlob: Blob | undefined;
        const recoveryURL = createForgeRuntimeRecoveryURL(
            exitContext,
            "http://localhost:6806/stage/build/desktop/#workspace",
            (blob) => {
                recoveryBlob = blob;
                return "blob:http://localhost:6806/recovery";
            },
        );

        expect(recoveryURL).toBe("blob:http://localhost:6806/recovery");
        expect(recoveryBlob?.type).toBe("text/html;charset=utf-8");
        const document = await recoveryBlob?.text();
        expect(document).toContain("default-src 'none'");
        expect(document).toContain("connect-src http://localhost:6806");
        expect(document).toContain("/api/s-forge/forge/runtime/status");
        expect(document).toContain("status.lifecycle===\"ready\"&&status.ready===true");
        expect(document).toContain(exitContext.jobId);
        expect(document).toContain(exitContext.targetRevision);
        expect(document).toContain("active.revision===config.targetRevision");
        expect(document).not.toContain("test-supervisor-token");
        expect(document).not.toContain("x-s-forge-supervisor-token");
    });
});
