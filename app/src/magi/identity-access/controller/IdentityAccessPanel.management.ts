/** 用途：面板状态工厂；使用范围：约束管理动作输入；解耦评估：同层状态模块。 */
import { createIdentityAccessPanelState } from "./IdentityAccessPanel.state";
/** 用途：身份类型与管理 API；使用范围：管理动作；解耦评估：跨目录依赖由 controller 网关集中转发。 */
import * as imports from "./imports";

/** 将身份列表项复制到编辑表单。 */
function applyEdit(
    panel: ReturnType<typeof createIdentityAccessPanelState>,
    identity: imports.MagiIdentityView,
) {
    panel.editForm.identityId = identity.identityId;
    panel.editForm.displayName = identity.displayName;
    panel.editForm.nickname = identity.nickname || "";
    panel.editForm.password = "";
    panel.editForm.routeClass = identity.routeClass;
    panel.editForm.enabled = identity.enabled;
    panel.editForm.tokenExpires = identity.tokenExpiresSeconds ?? 0;
    panel.editForm.channelBindings = (identity.channelBindings || []).map((binding) => ({ ...binding }));
}

/** 清空编辑表单并恢复新建身份的默认值。 */
function resetEdit(panel: ReturnType<typeof createIdentityAccessPanelState>) {
    panel.editForm.identityId = "";
    panel.editForm.displayName = "";
    panel.editForm.nickname = "";
    panel.editForm.password = "";
    panel.editForm.routeClass = "avatar-only";
    panel.editForm.enabled = true;
    panel.editForm.tokenExpires = 0;
    panel.editForm.channelBindings = [];
}

/** 从编辑表单移除一个尚未保存的渠道绑定。 */
function removeBinding(panel: ReturnType<typeof createIdentityAccessPanelState>, index: number) {
    panel.editForm.channelBindings = panel.editForm.channelBindings.filter((_, itemIndex) => {
        return itemIndex !== index;
    });
}

/** 为编辑中的身份签发一次性渠道绑定码。 */
async function generateBindCode(panel: ReturnType<typeof createIdentityAccessPanelState>) {
    const identityId = panel.editForm.identityId.trim();
    if (!identityId) {
        panel.statusText.value = "Please fill identity_id first.";
        return;
    }
    panel.busy.value = true;
    panel.statusText.value = "";
    try {
        const result = await imports.issueChannelBindCode(identityId);
        panel.bindCodeResult.value = { code: result.bindCode, expiresAt: result.expiresAt };
        panel.statusText.value = "Bind code generated.";
    } catch (error) {
        panel.statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        panel.busy.value = false;
    }
}

/** 复制当前一次性渠道绑定码。 */
async function copyBindCode(panel: ReturnType<typeof createIdentityAccessPanelState>) {
    const result = panel.bindCodeResult.value;
    if (!result) {
        return;
    }
    try {
        await navigator.clipboard.writeText(result.code);
        panel.statusText.value = "Bind code copied.";
    } catch {
        panel.statusText.value = "Copy failed.";
    }
}

/** 清除已显示的绑定码并刷新身份列表。 */
async function clearBindCode(
    panel: ReturnType<typeof createIdentityAccessPanelState>,
    refreshPanel: () => Promise<void>,
) {
    panel.bindCodeResult.value = null;
    await refreshPanel();
}

/** 新建或更新身份配置，密码留空时由后端执行更新语义。 */
async function saveIdentity(
    panel: ReturnType<typeof createIdentityAccessPanelState>,
    loadStats: () => Promise<void>,
) {
    const identityId = panel.editForm.identityId.trim();
    if (!identityId) {
        panel.statusText.value = "identity_id is required";
        return;
    }
    panel.busy.value = true;
    panel.statusText.value = "";
    try {
        await imports.upsertMagiIdentity({
            identityId,
            displayName: panel.editForm.displayName.trim() || identityId,
            nickname: panel.editForm.nickname.trim(),
            password: panel.editForm.password,
            routeClass: panel.editForm.routeClass,
            enabled: panel.editForm.enabled,
            tokenExpiresSeconds: panel.editForm.tokenExpires > 0 ? panel.editForm.tokenExpires : undefined,
            channelBindings: panel.editForm.channelBindings.length > 0
                ? panel.editForm.channelBindings
                : undefined,
        });
        panel.statusText.value = `Identity [${identityId}] saved.`;
        panel.loginForm.identityId ||= identityId;
        panel.editForm.password = "";
        await loadStats();
    } catch (error) {
        panel.statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        panel.busy.value = false;
    }
}

/** 删除指定身份并同步登录选择和统计。 */
async function removeIdentity(
    panel: ReturnType<typeof createIdentityAccessPanelState>,
    loadStats: () => Promise<void>,
    identityId: string,
) {
    panel.busy.value = true;
    panel.statusText.value = "";
    try {
        await imports.removeMagiIdentity(identityId);
        panel.statusText.value = `Removed [${identityId}].`;
        // 当前登录选择被删除时切换到仍存在的第一项，避免表单保留失效 ID。
        if (panel.loginForm.identityId === identityId) {
            const firstIdentity = panel.state.identities[0];
            panel.loginForm.identityId = firstIdentity?.identityId ?? "";
        }
        await loadStats();
    } catch (error) {
        panel.statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        panel.busy.value = false;
    }
}

/** 签发 Avatar 工具 token 并复制，文档绑定保持可选。 */
async function issueToken(
    panel: ReturnType<typeof createIdentityAccessPanelState>,
    loadStats: () => Promise<void>,
    identityId: string,
) {
    panel.busy.value = true;
    panel.statusText.value = "";
    try {
        const session = await imports.issueAvatarToken({
            identityId,
            channel: panel.issueForm.channel,
            expiresInSeconds: panel.issueForm.expiresIn > 0 ? panel.issueForm.expiresIn : undefined,
            documentId: panel.issueForm.documentId.trim() || undefined,
        });
        await navigator.clipboard.writeText(session.armorToken);
        panel.statusText.value = `Avatar token for [${identityId}] copied (${session.channel}).`;
        panel.issuingId.value = "";
        await imports.refreshMagiIdentities();
        await loadStats();
    } catch (error) {
        panel.statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        panel.busy.value = false;
    }
}

/** 展开或关闭指定身份的 token 签发表单。 */
function toggleIssueForm(panel: ReturnType<typeof createIdentityAccessPanelState>, identityId: string) {
    panel.issuingId.value = panel.issuingId.value === identityId ? "" : identityId;
}

/**
 * 作用：把无状态管理动作绑定到当前面板实例。
 * 意图：保持写操作可测试，同时向 Vue 模板提供简洁处理器。
 * 调用时机：Identity Access 面板控制器初始化时调用。
 */
/** @同步豁免: UI构建 */
export const createIdentityAccessManagementActions = (
    panel: ReturnType<typeof createIdentityAccessPanelState>,
    loadStats: () => Promise<void>,
    refreshPanel: () => Promise<void>,
) => {
    return {
        applyEdit: applyEdit.bind(null, panel),
        resetEdit: resetEdit.bind(null, panel),
        removeBinding: removeBinding.bind(null, panel),
        onGenerateBindCode: generateBindCode.bind(null, panel),
        onCopyBindCode: copyBindCode.bind(null, panel),
        onClearBindCode: clearBindCode.bind(null, panel, refreshPanel),
        onUpsert: saveIdentity.bind(null, panel, loadStats),
        onRemove: removeIdentity.bind(null, panel, loadStats),
        onIssueToken: issueToken.bind(null, panel, loadStats),
        toggleIssueForm: toggleIssueForm.bind(null, panel),
    };
};
