import {Dialog} from "../../dialog";
import {showMessage} from "../../dialog/message";
import {注册状态栏按钮, 渲染所有状态栏按钮} from "../../registry/StatusBarRegistry";
import {escapeAttr, escapeHtml} from "../../util/DOM/escape";
import {forgeI18n} from "../../util/siyuanEnvironments/forgeI18n.getI18n.environment";
import {ForgeRuntimeController} from "./controller";
import {getForgeProtectedApprovalKey} from "./types";
import type {ForgeRuntimeControllerState, ForgeRuntimeJob, ForgeSupervisorStatus} from "./types";
import "./style.scss";

const formatDateTime = (value?: string): string => {
    if (!value) {
        return "-";
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const buttonIcon = (icon: string) => `<svg><use xlink:href="#${icon}"></use></svg>`;

export class ForgeRuntimeControlView {
    private readonly controller: ForgeRuntimeController;
    private unsubscribe: (() => void) | undefined;
    private controlDialog: Dialog | undefined;
    private approvalDialog: {dialog: Dialog, key: string} | undefined;
    private dismissedApprovalKey: string | undefined;
    private lastErrorMessage: string | undefined;
    private statusButtonRegistered = false;

    constructor(controller: ForgeRuntimeController) {
        this.controller = controller;
    }

    public connect(): void {
        if (this.unsubscribe) {
            return;
        }
        this.unsubscribe = this.controller.subscribe((state) => this.render(state));
    }

    public openControlDialog(): void {
        if (this.controlDialog) {
            this.controlDialog.bringToFront();
            return;
        }
        const dialog = new Dialog({
            title: forgeI18n.forge.runtime.controlTitle,
            content: '<div class="forge-runtime" data-forge-runtime-control></div>',
            width: "640px",
            destroyCallback: () => {
                this.controlDialog = undefined;
            },
        });
        this.controlDialog = dialog;
        dialog.listen(dialog.bodyElement, "click", (event) => this.handleControlClick(event));
        this.renderControlDialog(this.controller.state);
    }

    public destroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.controlDialog?.destroy();
        this.controlDialog = undefined;
        this.approvalDialog?.dialog.destroy();
        this.approvalDialog = undefined;
    }

    private render(state: ForgeRuntimeControllerState): void {
        if (state.error && state.error.message !== this.lastErrorMessage) {
            this.lastErrorMessage = state.error.message;
            showMessage(escapeHtml(state.error.message), 6000, "error", "forgeRuntimeControlError");
        } else if (!state.error) {
            this.lastErrorMessage = undefined;
        }
        if (state.status?.available) {
            this.ensureStatusButton();
        }
        this.updateStatusButton(state);
        this.renderControlDialog(state);
        this.renderApprovalDialog(state);
    }

    private ensureStatusButton(): void {
        if (this.statusButtonRegistered) {
            return;
        }
        this.statusButtonRegistered = true;
        注册状态栏按钮({
            id: "ForgeRuntime",
            icon: "iconRefresh",
            tooltip: forgeI18n.forge.runtime.buttonTooltip,
            onClick: () => this.openControlDialog(),
            position: "right",
            order: 40,
        });
        if (document.getElementById("status")) {
            渲染所有状态栏按钮();
        }
    }

    private updateStatusButton(state: ForgeRuntimeControllerState): void {
        const button = document.getElementById("statusForgeRuntime");
        if (!button) {
            return;
        }
        const job = state.status?.status?.job;
        const pending = Boolean(job && getForgeProtectedApprovalKey(job));
        button.classList.toggle("toolbar__item--active", state.busy || pending || Boolean(job && !["completed", "failed", "rolled_back"].includes(job.state)));
        button.classList.toggle("ft__error", Boolean(state.error || job?.state === "failed" || job?.state === "rolled_back"));
        const detail = job ? `${job.state} / ${job.phase}` : forgeI18n.forge.runtime.noJob;
        button.setAttribute("aria-label", `${forgeI18n.forge.runtime.buttonTooltip}: ${detail}`);
    }

    private renderControlDialog(state: ForgeRuntimeControllerState): void {
        const root = this.controlDialog?.bodyElement.querySelector<HTMLElement>("[data-forge-runtime-control]");
        if (!root) {
            return;
        }
        const status = state.status?.status;
        const job = status?.job;
        const reason = root.querySelector<HTMLTextAreaElement>("#forgeRuntimeReason")?.value ??
            forgeI18n.forge.runtime.defaultReason;
        root.innerHTML = `${this.renderStatusSummary(status, job)}
<div class="forge-runtime__section">
    <label class="b3-label" for="forgeRuntimeReason">${escapeHtml(forgeI18n.forge.runtime.reason)}</label>
    <textarea id="forgeRuntimeReason" class="b3-text-field fn__block" rows="3">${escapeHtml(reason)}</textarea>
</div>
<div class="b3-dialog__action forge-runtime__actions">
    <button class="b3-button b3-button--cancel" data-forge-action="refresh"${state.busy ? " disabled" : ""}>${buttonIcon("iconRefresh")}${escapeHtml(forgeI18n.forge.runtime.refresh)}</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" data-forge-action="restart"${state.busy ? " disabled" : ""}>${buttonIcon("iconCirclePlay")}${escapeHtml(forgeI18n.forge.runtime.restart)}</button>
</div>`;
    }

    private renderStatusSummary(status?: ForgeSupervisorStatus, job?: ForgeRuntimeJob | null): string {
        if (!status) {
            return `<div class="forge-runtime__empty">${escapeHtml(forgeI18n.forge.runtime.unavailable)}</div>`;
        }
        const jobContent = job ? `<div class="forge-runtime__value">${escapeHtml(job.state)}</div>
<div class="forge-runtime__label">${escapeHtml(forgeI18n.forge.runtime.jobPhase)}</div>
<div class="forge-runtime__value">${escapeHtml(job.phase)}</div>
${job.error ? `<div class="forge-runtime__error">${escapeHtml(job.error)}</div>` : ""}` :
            `<div class="forge-runtime__value forge-runtime__value--muted">${escapeHtml(forgeI18n.forge.runtime.noJob)}</div>`;
        return `<div class="forge-runtime__summary">
    <div class="forge-runtime__label">${escapeHtml(forgeI18n.forge.runtime.activeRevision)}</div>
    <div class="forge-runtime__value forge-runtime__revision" title="${escapeAttr(status.activeVersion.revision)}">${escapeHtml(status.activeVersion.revision)}</div>
    <div class="forge-runtime__label">${escapeHtml(forgeI18n.forge.runtime.jobState)}</div>
    ${jobContent}
</div>`;
    }

    private renderApprovalDialog(state: ForgeRuntimeControllerState): void {
        const job = state.status?.status?.job;
        const approvalKey = job ? getForgeProtectedApprovalKey(job) : undefined;
        if (!job || !approvalKey) {
            if (this.approvalDialog) {
                this.approvalDialog.dialog.destroy();
                this.approvalDialog = undefined;
            }
            this.dismissedApprovalKey = undefined;
            return;
        }
        if (this.approvalDialog?.key === approvalKey || this.dismissedApprovalKey === approvalKey) {
            return;
        }
        this.approvalDialog?.dialog.destroy();
        const approval = job.protectedTestApproval;
        const paths = approval?.paths.map((path) => `<li><code>${escapeHtml(path)}</code></li>`).join("") ?? "";
        const dialog = new Dialog({
            title: forgeI18n.forge.runtime.approvalTitle,
            content: `<div class="forge-runtime forge-runtime--approval">
    <div class="forge-runtime__summary">
        <div class="forge-runtime__label">Job ID</div>
        <div class="forge-runtime__value forge-runtime__revision">${escapeHtml(job.id)}</div>
        <div class="forge-runtime__label">Revision</div>
        <div class="forge-runtime__value forge-runtime__revision" title="${escapeAttr(approval?.revision ?? "")}">${escapeHtml(approval?.revision ?? "")}</div>
        <div class="forge-runtime__label">${escapeHtml(forgeI18n.forge.runtime.deadline)}</div>
        <div class="forge-runtime__value">${escapeHtml(formatDateTime(approval?.deadline))}</div>
    </div>
    <div class="forge-runtime__section">
        <div class="forge-runtime__label">${escapeHtml(forgeI18n.forge.runtime.protectedFiles)}</div>
        <ul class="forge-runtime__paths">${paths}</ul>
    </div>
    <div class="b3-dialog__action forge-runtime__actions">
        <button class="b3-button b3-button--remove" data-forge-approval="reject">${buttonIcon("iconCloseRound")}${escapeHtml(forgeI18n.forge.runtime.reject)}</button>
        <div class="fn__space"></div>
        <button class="b3-button b3-button--text" data-forge-approval="approve">${buttonIcon("iconCheck")}${escapeHtml(forgeI18n.forge.runtime.approve)}</button>
    </div>
</div>`,
            width: "680px",
            destroyCallback: () => {
                if (this.approvalDialog?.dialog === dialog) {
                    this.approvalDialog = undefined;
                    const currentJob = this.controller.state.status?.status?.job;
                    if (currentJob && getForgeProtectedApprovalKey(currentJob) === approvalKey) {
                        this.dismissedApprovalKey = approvalKey;
                    }
                }
            },
        });
        this.approvalDialog = {dialog, key: approvalKey};
        dialog.listen(dialog.bodyElement, "click", (event) => this.handleApprovalClick(event, job));
    }

    private handleControlClick(event: Event): void {
        const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-forge-action]") : null;
        if (!target || target.hasAttribute("disabled")) {
            return;
        }
        const action = target.dataset.forgeAction;
        if (action === "refresh") {
            void this.controller.refresh().catch((error) => this.reportActionError(error));
            return;
        }
        if (action === "restart") {
            const reason = this.controlDialog?.bodyElement.querySelector<HTMLTextAreaElement>("#forgeRuntimeReason")?.value ?? "";
            void this.controller.restart(reason).then(() => {
                showMessage(forgeI18n.forge.runtime.requestAccepted);
            }).catch((error) => this.reportActionError(error));
        }
    }

    private handleApprovalClick(event: Event, job: ForgeRuntimeJob): void {
        const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-forge-approval]") : null;
        const approval = job.protectedTestApproval;
        if (!target || !approval || this.controller.state.busy) {
            return;
        }
        const operation = target.dataset.forgeApproval === "approve" ?
            this.controller.approveProtectedTests(job.id, approval.revision) :
            this.controller.rejectProtectedTests(job.id, approval.revision);
        const successMessage = target.dataset.forgeApproval === "approve" ?
            forgeI18n.forge.runtime.approvalAccepted : forgeI18n.forge.runtime.rejectionAccepted;
        void operation.then(() => {
            this.dismissedApprovalKey = getForgeProtectedApprovalKey(job);
            this.approvalDialog?.dialog.destroy();
            this.approvalDialog = undefined;
            showMessage(successMessage);
        }).catch((error) => this.reportActionError(error));
    }

    private reportActionError(error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        showMessage(escapeHtml(message), 6000, "error", "forgeRuntimeActionError");
    }
}
