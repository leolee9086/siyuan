/** 用途：响应式原语和身份会话契约；使用范围：面板状态工厂；解耦评估：跨目录依赖由 controller 网关集中转发。 */
import * as imports from "./imports";

/** 创建登录、身份编辑和 token 签发表单。 */
const createForms = () => {
    const channelOptions: imports.MagiRequestChannel[] = [];
    channelOptions.push("magi-main-ui", "tool-claude-code", "tool-openai-sdk");
    channelOptions.push("tool-claude-sdk", "tool-custom", "system-cron");
    const loginForm = imports.reactive<{
        identityId: string;
        password: string;
        channel: imports.MagiRequestChannel;
        expiresIn: number;
    }>({
        identityId: "",
        password: "",
        channel: "magi-main-ui",
        expiresIn: 0,
    });
    const editForm = imports.reactive<{
        identityId: string;
        displayName: string;
        nickname: string;
        password: string;
        routeClass: "guardian" | "avatar-only";
        enabled: boolean;
        tokenExpires: number;
        channelBindings: imports.MagiChannelBinding[];
    }>({
        identityId: "",
        displayName: "",
        nickname: "",
        password: "",
        routeClass: "avatar-only",
        enabled: true,
        tokenExpires: 0,
        channelBindings: [],
    });
    const issueForm = imports.reactive<{
        channel: imports.MagiRequestChannel;
        expiresIn: number;
        documentId: string;
    }>({
        channel: "tool-openai-sdk",
        expiresIn: 0,
        documentId: "",
    });
    return { channelOptions, loginForm, editForm, issueForm };
};

/** 按 ID 或展示名过滤身份列表。 */
function filterIdentities(identities: readonly imports.MagiIdentityView[], rawQuery: string) {
    const query = rawQuery.trim().toLowerCase();
    // 空查询保留后端列表顺序，不创建无意义的副本。
    if (!query) {
        return identities;
    }
    return identities.filter((identity) => {
        return identity.identityId.toLowerCase().includes(query) ||
            identity.displayName.toLowerCase().includes(query);
    });
}

/**
 * 作用：创建一个 Identity Access 面板实例的响应式状态。
 * 意图：让 Dock、Tab 和独立页面拥有各自表单，同时共享身份会话服务。
 * 调用时机：每次挂载 IdentityAccessPanel 时调用一次。
 */
/** @同步豁免: 生命周期 */
export const createIdentityAccessPanelState = () => {
    const state = imports.useMagiIdentitySessionState();
    const busy = imports.ref(false);
    const loading = imports.ref(false);
    const statusText = imports.ref("");
    const attention = imports.ref(false);
    const attentionTimer = imports.ref<ReturnType<typeof setTimeout> | null>(null);
    const panelRef = imports.ref<HTMLElement | null>(null);
    const searchQuery = imports.ref("");
    const stats = imports.ref<imports.MagiIdentityStats | null>(null);
    const bindCodeResult = imports.ref<{ code: string; expiresAt: number } | null>(null);
    const issuingId = imports.ref("");
    const forms = createForms();

    const filteredIdentities = imports.computed(() => filterIdentities(state.identities, searchQuery.value));

    const apiEndpoint = imports.computed(() => {
        return `${window.location.origin}/api/s-forge/magi/v1/chat/completions`;
    });

    return {
        state,
        busy,
        loading,
        statusText,
        attention,
        attentionTimer,
        panelRef,
        searchQuery,
        stats,
        ...forms,
        bindCodeResult,
        issuingId,
        filteredIdentities,
        apiEndpoint,
    };
};
