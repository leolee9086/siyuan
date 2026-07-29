import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    dialogs: [] as Array<{
        bodyElement: HTMLElement;
        destroy: () => void;
    }>,
    fetchSyncPost: vi.fn(),
    registerStatusButton: vi.fn(),
    renderStatusButtons: vi.fn(),
    showMessage: vi.fn(),
}));

vi.mock("../../src/util/network/fetch", () => ({
    fetchSyncPost: runtime.fetchSyncPost,
}));

vi.mock("../../src/dialog", () => {
    interface DialogOptions {
        content: string;
        destroyCallback?: () => void;
    }

    class Dialog {
        public readonly bodyElement = document.createElement("div");
        private readonly options: DialogOptions;
        private destroyed = false;

        constructor(options: DialogOptions) {
            this.options = options;
            this.bodyElement.innerHTML = options.content;
            document.body.appendChild(this.bodyElement);
            runtime.dialogs.push(this);
        }

        public listen(element: Element, eventName: string, listener: EventListener): void {
            element.addEventListener(eventName, listener);
        }

        public bringToFront(): void {
            // The focused behavior is not relevant to approval de-duplication.
        }

        public destroy(): void {
            if (this.destroyed) {
                return;
            }
            this.destroyed = true;
            this.bodyElement.remove();
            this.options.destroyCallback?.();
        }
    }

    return {Dialog};
});

vi.mock("../../src/dialog/message", () => ({
    showMessage: runtime.showMessage,
}));

vi.mock("../../src/registry/StatusBarRegistry", () => ({
    注册状态栏按钮: runtime.registerStatusButton,
    渲染所有状态栏按钮: runtime.renderStatusButtons,
}));

vi.mock("../../src/util/siyuanEnvironments/forgeI18n.getI18n.environment", () => ({
    forgeI18n: {
        forge: {
            runtime: {
                activeRevision: "Active revision",
                approvalAccepted: "Approval accepted",
                approvalTitle: "Approval required",
                approve: "Approve",
                buttonTooltip: "Forge Kernel Update",
                controlTitle: "Forge Kernel Update",
                deadline: "Deadline",
                defaultReason: "Validate current revision",
                jobPhase: "Job phase",
                jobState: "Job state",
                noJob: "No job",
                protectedFiles: "Protected files",
                reason: "Reason",
                refresh: "Refresh",
                reject: "Reject",
                rejectionAccepted: "Rejection accepted",
                requestAccepted: "Request accepted",
                restart: "Validate and hot-swap",
                unavailable: "Unavailable",
            },
        },
    },
}));

import {ForgeRuntimeClient} from "../../src/sforge/forgeRuntime/client";
import {ForgeRuntimeController} from "../../src/sforge/forgeRuntime/controller";
import {ForgeRuntimeControlView} from "../../src/sforge/forgeRuntime/view";

const pendingStatus = {
    available: true,
    status: {
        mode: "forge-source-supervisor",
        processId: 100,
        port: 6806,
        activeVersion: {id: "version-1", revision: "revision-1", state: "healthy"},
        retainedVersions: [],
        job: {
            id: "job-1",
            state: "awaiting_protected_test_approval",
            phase: "protected_test_approval",
            reason: "manual validation",
            error: "",
            protectedTestApproval: {
                state: "pending",
                revision: "revision-1",
                paths: ["kernel/api/forge_runtime_test.go"],
                deadline: "2026-07-30T12:00:00.000Z",
            },
        },
    },
};

describe("Forge Runtime approval view", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = "";
        runtime.dialogs.length = 0;
        runtime.fetchSyncPost.mockReset();
        runtime.registerStatusButton.mockReset();
        runtime.renderStatusButtons.mockReset();
        runtime.showMessage.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("opens one visible approval dialog for each pending job and revision", async () => {
        runtime.fetchSyncPost.mockResolvedValue({code: 0, msg: "", data: pendingStatus});
        const controller = new ForgeRuntimeController(new ForgeRuntimeClient());
        const view = new ForgeRuntimeControlView(controller);
        view.connect();

        await controller.start();
        expect(runtime.dialogs).toHaveLength(1);
        const approvalDialog = runtime.dialogs.at(0);
        if (!approvalDialog) {
            throw new Error("pending approval dialog was not created");
        }
        expect(approvalDialog.bodyElement.textContent).toContain("kernel/api/forge_runtime_test.go");

        await controller.refresh();
        expect(runtime.dialogs).toHaveLength(1);

        approvalDialog.destroy();
        await controller.refresh();
        expect(runtime.dialogs).toHaveLength(1);

        view.destroy();
        controller.destroy();
    });
});
