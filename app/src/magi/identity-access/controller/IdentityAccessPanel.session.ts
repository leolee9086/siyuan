/** 用途：面板状态工厂；使用范围：约束动作输入；解耦评估：同层状态模块。 */
import { createIdentityAccessPanelState } from "./IdentityAccessPanel.state";
/** 用途：armor 会话服务；使用范围：会话动作；解耦评估：跨目录依赖由 controller 网关集中转发。 */
import * as imports from "./imports";

/** 加载可选统计信息；统计失败不阻断登录和身份管理。 */
async function loadStats(panel: ReturnType<typeof createIdentityAccessPanelState>) {
    try {
        panel.stats.value = await imports.fetchMagiIdentityStats();
    } catch {
        panel.stats.value = null;
    }
}

/** 刷新身份列表和统计，并在首次加载时选择第一个身份。 */
async function refreshPanel(panel: ReturnType<typeof createIdentityAccessPanelState>) {
    panel.loading.value = true;
    panel.statusText.value = "";
    try {
        await imports.refreshMagiIdentities();
        // 首次打开尚未选择身份时，默认选中后端返回的第一项，避免额外点击。
        if (!panel.loginForm.identityId && panel.state.identities.length > 0) {
            const firstIdentity = panel.state.identities[0];
            panel.loginForm.identityId = firstIdentity.identityId;
        }
        await loadStats(panel);
        panel.statusText.value = "Refreshed.";
    } catch (error) {
        panel.statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        panel.loading.value = false;
    }
}

/** 使用选中的身份登录并激活当前 renderer 的 armor 会话。 */
async function login(panel: ReturnType<typeof createIdentityAccessPanelState>) {
    const identityId = panel.loginForm.identityId.trim();
    const password = panel.loginForm.password.trim();
    // 身份和口令都是登录接口的必要输入，缺一时不发送无效请求。
    if (!identityId || !password) {
        panel.statusText.value = "identity and password required";
        return;
    }
    panel.busy.value = true;
    panel.statusText.value = "";
    try {
        const session = await imports.loginMagiIdentity({
            identityId,
            password,
            nickname: "",
            channel: panel.loginForm.channel,
            activate: true,
            expiresInSeconds: panel.loginForm.expiresIn > 0 ? panel.loginForm.expiresIn : undefined,
        });
        panel.statusText.value = `Session activated: ${session.identityId} (${session.channel})`;
        await loadStats(panel);
    } catch (error) {
        panel.statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        panel.busy.value = false;
    }
}

/** 复制标准 MAGI Chat Completions 地址。 */
async function copyEndpoint(panel: ReturnType<typeof createIdentityAccessPanelState>) {
    try {
        await navigator.clipboard.writeText(panel.apiEndpoint.value);
        panel.statusText.value = "Endpoint URL copied to clipboard.";
    } catch {
        panel.statusText.value = "Failed to copy endpoint URL.";
    }
}

/** 复制当前活动 armor token；没有活动会话时保持无操作。 */
async function copyToken(panel: ReturnType<typeof createIdentityAccessPanelState>) {
    const token = panel.state.activeSession?.armorToken;
    if (!token) {
        return;
    }
    try {
        await navigator.clipboard.writeText(token);
        panel.statusText.value = "Token copied to clipboard.";
    } catch {
        panel.statusText.value = "Failed to copy token.";
    }
}

/** 清除内存中的活动 armor，并由会话服务同步登出事件。 */
function logout(panel: ReturnType<typeof createIdentityAccessPanelState>) {
    imports.clearActiveMagiArmorSession();
    panel.statusText.value = "Session cleared.";
}

/** 将毫秒时间戳格式化为当前客户端地区时间。 */
function formatTime(timestamp: number) {
    return timestamp ? new Date(timestamp).toLocaleString() : "-";
}

/**
 * 作用：把无状态会话动作绑定到当前面板实例。
 * 意图：保持动作可测试，同时向 Vue 模板提供无参处理器。
 * 调用时机：Identity Access 面板控制器初始化时调用。
 */
/** @同步豁免: UI构建 */
export const createIdentityAccessSessionActions = (
    panel: ReturnType<typeof createIdentityAccessPanelState>,
) => {
    return {
        loadStats: loadStats.bind(null, panel),
        onRefresh: refreshPanel.bind(null, panel),
        onLogin: login.bind(null, panel),
        onCopyEndpoint: copyEndpoint.bind(null, panel),
        onCopyToken: copyToken.bind(null, panel),
        onLogout: logout.bind(null, panel),
        fmtTime: formatTime,
    };
};
