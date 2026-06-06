<template>
  <section
    ref="panelRef"
    class="magi-identity-panel"
    :class="{ 'magi-identity-panel--attention': attention }"
  >
    <header class="magi-identity-panel__header">
      <div class="magi-identity-panel__title">TOKEN MANAGEMENT</div>
      <div class="magi-identity-panel__header-actions">
        <button type="button" class="magi-identity-panel__btn" :disabled="loading" @click="onRefresh">
          {{ loading ? "..." : "REFRESH" }}
        </button>
      </div>
    </header>

    <!-- Stats Bar -->
    <div v-if="stats" class="magi-identity-panel__stats">
      <div class="magi-identity-panel__stat">
        <span class="magi-identity-panel__stat-value">{{ stats.totalIdentities }}</span>
        <span class="magi-identity-panel__stat-label">Identities</span>
      </div>
      <div class="magi-identity-panel__stat">
        <span class="magi-identity-panel__stat-value">{{ stats.enabledCount }}</span>
        <span class="magi-identity-panel__stat-label">Active</span>
      </div>
      <div class="magi-identity-panel__stat">
        <span class="magi-identity-panel__stat-value">{{ stats.totalUsage }}</span>
        <span class="magi-identity-panel__stat-label">Requests</span>
      </div>
    </div>

    <div class="magi-identity-panel__columns">
      <!-- Left Column: Session + Login -->
      <div class="magi-identity-panel__col">
        <!-- Active Session -->
        <section class="magi-identity-panel__block">
          <div class="magi-identity-panel__block-title">ACTIVE SESSION</div>
          <div v-if="state.activeSession" class="magi-identity-panel__session">
            <div class="magi-identity-panel__session-field">
              <span class="magi-identity-panel__session-label">ID</span>
              <span class="magi-identity-panel__session-value">{{ state.activeSession.identityId }}</span>
            </div>
            <div class="magi-identity-panel__session-field">
              <span class="magi-identity-panel__session-label">Nick</span>
              <span class="magi-identity-panel__session-value">{{ state.activeSession.nickname }}</span>
            </div>
            <div class="magi-identity-panel__session-field">
              <span class="magi-identity-panel__session-label">Route</span>
              <span class="magi-identity-panel__session-value">{{ state.activeSession.routeClass }}</span>
            </div>
            <div class="magi-identity-panel__session-field">
              <span class="magi-identity-panel__session-label">Channel</span>
              <span class="magi-identity-panel__session-value">{{ state.activeSession.channel }}</span>
            </div>
            <div class="magi-identity-panel__session-field">
              <span class="magi-identity-panel__session-label">Expires</span>
              <span class="magi-identity-panel__session-value">{{ fmtTime(state.activeSession.expiresAt) }}</span>
            </div>
            <div class="magi-identity-panel__session-token">
              <span class="magi-identity-panel__session-label">Endpoint</span>
              <code class="magi-identity-panel__token-key">{{ apiEndpoint }}</code>
              <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="onCopyEndpoint">COPY URL</button>
            </div>
            <div class="magi-identity-panel__session-token">
              <span class="magi-identity-panel__session-label">Armor Token</span>
              <code class="magi-identity-panel__token-key magi-identity-panel__token-full">{{ state.activeSession.armorToken }}</code>
              <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="onCopyToken">COPY</button>
            </div>
            <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--danger" @click="onLogout">
              LOGOUT
            </button>
          </div>
          <div v-else class="magi-identity-panel__hint">No active session.</div>
        </section>

        <!-- Login -->
        <section class="magi-identity-panel__block">
          <div class="magi-identity-panel__block-title">LOGIN (MAIN CHAT)</div>
          <label class="magi-identity-panel__label">
            IDENTITY
            <select v-model="loginForm.identityId" class="magi-identity-panel__select">
              <option v-for="id in state.identities" :key="id.identityId" :value="id.identityId">
                {{ id.identityId }} [{{ id.routeClass }}]
              </option>
            </select>
          </label>
          <label class="magi-identity-panel__label">
            PASSWORD
            <input v-model="loginForm.password" class="magi-identity-panel__input" type="password" />
          </label>
          <label class="magi-identity-panel__label">
            CHANNEL
            <select v-model="loginForm.channel" class="magi-identity-panel__select">
              <option v-for="ch in channelOptions" :key="ch" :value="ch">{{ ch }}</option>
            </select>
          </label>
          <label class="magi-identity-panel__label">
            TOKEN EXPIRY
            <select v-model="loginForm.expiresIn" class="magi-identity-panel__select">
              <option :value="600">10 minutes</option>
              <option :value="3600">1 hour</option>
              <option :value="21600">6 hours</option>
              <option :value="86400">24 hours</option>
              <option :value="604800">7 days</option>
              <option :value="2592000">30 days</option>
              <option :value="0">Identity default</option>
            </select>
          </label>
          <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--primary" :disabled="busy" @click="onLogin">
            LOGIN & ACTIVATE
          </button>
        </section>
      </div>

      <!-- Right Column: Identity Management -->
      <div class="magi-identity-panel__col">
        <section class="magi-identity-panel__block">
          <div class="magi-identity-panel__block-title">IDENTITY MANAGEMENT</div>
          <div class="magi-identity-panel__form-grid">
            <label class="magi-identity-panel__label">
              IDENTITY ID
              <input v-model="editForm.identityId" class="magi-identity-panel__input" type="text" />
            </label>
            <label class="magi-identity-panel__label">
              DISPLAY NAME
              <input v-model="editForm.displayName" class="magi-identity-panel__input" type="text" />
            </label>
            <label class="magi-identity-panel__label">
              NICKNAME
              <input v-model="editForm.nickname" class="magi-identity-panel__input" type="text" placeholder="used as caller display name" />
            </label>
            <label class="magi-identity-panel__label">
              PASSWORD <small>(optional for update)</small>
              <input v-model="editForm.password" class="magi-identity-panel__input" type="password" />
            </label>
            <label class="magi-identity-panel__label">
              ROUTE CLASS
              <select v-model="editForm.routeClass" class="magi-identity-panel__select">
                <option value="guardian">guardian</option>
                <option value="avatar-only">avatar-only</option>
              </select>
            </label>
            <label class="magi-identity-panel__label">
              TOKEN EXPIRY
              <select v-model="editForm.tokenExpires" class="magi-identity-panel__select">
                <option :value="0">Default (20 min)</option>
                <option :value="600">10 minutes</option>
                <option :value="3600">1 hour</option>
                <option :value="21600">6 hours</option>
                <option :value="86400">24 hours</option>
                <option :value="604800">7 days</option>
                <option :value="2592000">30 days</option>
              </select>
            </label>
            <label class="magi-identity-panel__check">
              <input v-model="editForm.enabled" type="checkbox" /> ENABLED
            </label>
          </div>
          <!-- Channel Bindings -->
          <div class="magi-identity-panel__block magi-identity-panel__block--sub">
            <div class="magi-identity-panel__block-title">CHANNEL BINDINGS</div>
            <div v-if="editForm.channelBindings.length === 0 && !bindCodeResult" class="magi-identity-panel__hint">No channel bindings.</div>
            <div v-for="(b, idx) in editForm.channelBindings" :key="idx" class="magi-identity-panel__binding-row">
              <span class="magi-identity-panel__binding-key">{{ b.channelId }}/{{ b.accountId }}/{{ b.userId }}</span>
              <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm magi-identity-panel__btn--danger" @click="removeBinding(idx)">REMOVE</button>
            </div>
            <div v-if="!bindCodeResult" class="magi-identity-panel__binding-add">
              <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--primary magi-identity-panel__btn--sm" :disabled="busy" @click="onGenerateBindCode">GENERATE BIND CODE</button>
            </div>
            <div v-if="bindCodeResult" class="magi-identity-panel__bind-code">
              <div class="magi-identity-panel__bind-code-label">将该验证码发送给渠道中的 bot：</div>
              <code class="magi-identity-panel__bind-code-value">{{ bindCodeResult.code }}</code>
              <div class="magi-identity-panel__bind-code-expires">有效期 {{ Math.ceil((bindCodeResult.expiresAt - Date.now()) / 1000) }}s</div>
              <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="onCopyBindCode">COPY</button>
              <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="bindCodeResult = null; onRefresh()">REFRESH LIST</button>
            </div>
          </div>
          <div class="magi-identity-panel__actions">
            <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--primary" :disabled="busy" @click="onUpsert">SAVE</button>
            <button type="button" class="magi-identity-panel__btn" :disabled="busy" @click="resetEdit">RESET</button>
          </div>
        </section>

        <!-- Identity List -->
        <section class="magi-identity-panel__block">
          <div class="magi-identity-panel__block-title">
            IDENTITY LIST
            <span class="magi-identity-panel__block-count">({{ filteredIdentities.length }})</span>
          </div>
          <label class="magi-identity-panel__label">
            <input v-model="searchQuery" class="magi-identity-panel__input" type="text" placeholder="Search identity..." />
          </label>
          <div class="magi-identity-panel__list">
            <article
              v-for="id in filteredIdentities"
              :key="id.identityId"
              class="magi-identity-panel__item"
            >
              <div class="magi-identity-panel__item-main">
                <div class="magi-identity-panel__item-id">{{ id.identityId }}</div>
                <div class="magi-identity-panel__item-meta">
                  {{ id.displayName }} | {{ id.routeClass }}
                  <span :class="id.enabled ? 'magi-identity-panel__tag--ok' : 'magi-identity-panel__tag--muted'">
                    {{ id.enabled ? "enabled" : "disabled" }}
                  </span>
                  <span v-if="id.usageCount" class="magi-identity-panel__tag--info">{{ id.usageCount }} req</span>
                  <span v-if="id.channelBindings && id.channelBindings.length > 0" class="magi-identity-panel__tag--info">
                    {{ id.channelBindings.length }} channel(s)
                  </span>
                </div>
                <div v-if="id.channelBindings && id.channelBindings.length > 0" class="magi-identity-panel__item-bindings">
                  <span v-for="b in id.channelBindings" :key="`${b.channelId}:${b.accountId}:${b.userId}`" class="magi-identity-panel__binding-tag">
                    {{ b.channelId }}/{{ b.accountId }}/{{ b.userId }}
                  </span>
                </div>
              </div>
              <div class="magi-identity-panel__item-actions">
                <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="applyEdit(id)">EDIT</button>
                <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="toggleIssueForm(id.identityId)">TOKEN</button>
                <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm magi-identity-panel__btn--danger" :disabled="busy" @click="onRemove(id.identityId)">DEL</button>
              </div>
              <div v-if="issuingId === id.identityId" class="magi-identity-panel__issue-form">
                <label class="magi-identity-panel__label">
                  CHANNEL
                  <select v-model="issueForm.channel" class="magi-identity-panel__select">
                    <option v-for="ch in channelOptions" :key="ch" :value="ch">{{ ch }}</option>
                  </select>
                </label>
                <label class="magi-identity-panel__label">
                  EXPIRY
                  <select v-model="issueForm.expiresIn" class="magi-identity-panel__select">
                    <option :value="600">10 minutes</option>
                    <option :value="3600">1 hour</option>
                    <option :value="21600">6 hours</option>
                    <option :value="86400">24 hours</option>
                    <option :value="604800">7 days</option>
                    <option :value="2592000">30 days</option>
                    <option :value="0">Identity default</option>
                  </select>
                </label>
                <label class="magi-identity-panel__label">
                  BOUND DOC ID
                  <input v-model="issueForm.documentId" class="magi-identity-panel__input" type="text" placeholder="optional note id" />
                </label>
                <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--primary magi-identity-panel__btn--sm" :disabled="busy" @click="onIssueToken(id.identityId)">ISSUE & COPY</button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>

    <div v-if="statusText" class="magi-identity-panel__status">{{ statusText }}</div>
    <div v-if="state.lastError" class="magi-identity-panel__error">{{ state.lastError }}</div>

    <MagiConfirmDialog
      v-if="dialogTarget"
      title="WRITE AVATAR IDENTITY"
      :body="`No bound document. Write avatar identity for [${dialogTarget}] in main chat?`"
      confirm-text="GO"
      cancel-text="CANCEL"
      @confirm="onConfirmWriteAvatar(dialogTarget)"
      @cancel="dialogTarget = ''"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import type { MagiIdentityView, MagiRequestChannel, MagiIdentityStats, MagiChannelBinding } from "../../service/magiIdentitySession";
import {
    bindChannelIdentity,
    clearActiveMagiArmorSession,
    fetchMagiIdentityStats,
    issueAvatarToken,
    issueChannelBindCode,
    loginMagiIdentity,
    MAGI_IDENTITY_REQUIRED_EVENT,
    MAGI_WRITE_AVATAR_EVENT,
    refreshMagiIdentities,
    removeMagiIdentity,
    unbindChannelIdentity,
    upsertMagiIdentity,
    useMagiIdentitySessionState,
} from "../../service/magiIdentitySession";
import MagiConfirmDialog from "../MagiConfirmDialog.vue";
import "./MagiIdentityPanel.css";

const state = useMagiIdentitySessionState();
const busy = ref(false);
const loading = ref(false);
const statusText = ref("");
const attention = ref(false);
const panelRef = ref<HTMLElement | null>(null);
const searchQuery = ref("");
const stats = ref<MagiIdentityStats | null>(null);
let attentionTimer: ReturnType<typeof setTimeout> | null = null;

const channelOptions: MagiRequestChannel[] = [
    "magi-main-ui",
    "tool-claude-code",
    "tool-openai-sdk",
    "tool-claude-sdk",
    "tool-custom",
    "system-cron",
];

const loginForm = reactive({
    identityId: "",
    password: "",
    channel: "magi-main-ui" as MagiRequestChannel,
    expiresIn: 0,
});

const editForm = reactive({
    identityId: "",
    displayName: "",
    nickname: "",
    password: "",
    routeClass: "avatar-only" as "guardian" | "avatar-only",
    enabled: true,
    tokenExpires: 0,
    channelBindings: [] as MagiChannelBinding[],
});

const newBinding = reactive({
    channelId: "",
    accountId: "",
    userId: "",
});

const bindCodeResult = ref<{ code: string; expiresAt: number } | null>(null);

const availableChannels = ref<ChannelStatusView[]>([]);
const availableAccounts = ref<AccountView[]>([]);
const trustConfig = ref<ChannelTrustConfigView | null>(null);

const knownUsers = computed<{ userId: string; nickname: string }[]>(() => {
    const chId = newBinding.channelId;
    const acctId = newBinding.accountId;
    if (!chId || !acctId || !trustConfig.value) {
return [];
}
    const chanCfg = trustConfig.value.channels[chId];
    if (!chanCfg) {
return [];
}
    const acctCfg = chanCfg.perAccount[acctId];
    if (!acctCfg) {
return [];
}
    const users: { userId: string; nickname: string }[] = [];
    for (const [uid, override] of Object.entries(acctCfg.perUser)) {
        users.push({ userId: uid, nickname: override.nickname || uid });
    }
    // also include users from blockList (might be listed even if blocked)
    for (const uid of acctCfg.blockList) {
        if (!users.some(u => u.userId === uid)) {
            users.push({ userId: uid, nickname: uid });
        }
    }
    // also include users from allowList
    for (const uid of acctCfg.allowList) {
        if (!users.some(u => u.userId === uid)) {
            users.push({ userId: uid, nickname: uid });
        }
    }
    return users;
});

const issuingId = ref("");
const dialogTarget = ref("");
const issueForm = reactive({
    channel: "tool-openai-sdk" as MagiRequestChannel,
    expiresIn: 0,
    documentId: "",
});

const filteredIdentities = computed(() => {
    if (!searchQuery.value.trim()) {
        return state.identities;
    }
    const q = searchQuery.value.toLowerCase();
    return state.identities.filter(id =>
        id.identityId.toLowerCase().includes(q) ||
        id.displayName.toLowerCase().includes(q)
    );
});

const apiEndpoint = computed(() => {
    const base = window.location.origin;
    return base + "/api/s-forge/magi/v1/chat/completions";
});

const maskedToken = computed(() => {
    if (!state.activeSession) {
return "";
}
    const t = state.activeSession.armorToken;
    if (t.length <= 12) {
return t;
}
    return t.slice(0, 12) + "..." + t.slice(-6);
});

function fmtTime(ts: number): string {
    if (!ts) {
return "-";
}
    return new Date(ts).toLocaleString();
}

function applyEdit(id: MagiIdentityView): void {
    editForm.identityId = id.identityId;
    editForm.displayName = id.displayName;
    editForm.nickname = id.nickname || "";
    editForm.password = "";
    editForm.routeClass = id.routeClass;
    editForm.enabled = id.enabled;
    editForm.tokenExpires = id.tokenExpiresSeconds ?? 0;
    editForm.channelBindings = (id.channelBindings || []).map(b => ({ ...b }));
}

function resetEdit(): void {
    editForm.identityId = "";
    editForm.displayName = "";
    editForm.nickname = "";
    editForm.password = "";
    editForm.routeClass = "avatar-only";
    editForm.enabled = true;
    editForm.tokenExpires = 0;
    editForm.channelBindings = [];
    newBinding.channelId = "";
    newBinding.accountId = "";
    newBinding.userId = "";
}

async function loadStats(): Promise<void> {
    try {
        stats.value = await fetchMagiIdentityStats();
    } catch {
        // stats are optional display
    }
}

async function onRefresh(): Promise<void> {
    loading.value = true;
    statusText.value = "";
    try {
        await refreshMagiIdentities();
        if (!loginForm.identityId && state.identities.length > 0) {
            loginForm.identityId = state.identities[0].identityId;
            loginForm.nickname = state.identities[0].displayName;
        }
        await loadStats();
        statusText.value = "Refreshed.";
    } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        loading.value = false;
    }
}

function addBinding(): void {
    const ch = newBinding.channelId.trim();
    const acct = newBinding.accountId.trim();
    const uid = newBinding.userId.trim();
    if (!ch || !acct || !uid) {
return;
}
    if (editForm.channelBindings.some(b => b.channelId === ch && b.accountId === acct && b.userId === uid)) {
return;
}
    editForm.channelBindings = [...editForm.channelBindings, { channelId: ch, accountId: acct, userId: uid }];
    newBinding.channelId = "";
    newBinding.accountId = "";
    newBinding.userId = "";
}

function removeBinding(idx: number): void {
    editForm.channelBindings = editForm.channelBindings.filter((_, i) => i !== idx);
}

async function onGenerateBindCode(): Promise<void> {
    const id = editForm.identityId.trim();
    if (!id) {
 statusText.value = "Please fill identity_id first."; return; 
}
    busy.value = true;
    statusText.value = "";
    try {
        const result = await issueChannelBindCode(id);
        bindCodeResult.value = { code: result.bindCode, expiresAt: result.expiresAt };
        statusText.value = "Bind code generated.";
    } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        busy.value = false;
    }
}

async function onCopyBindCode(): Promise<void> {
    if (!bindCodeResult.value) {
return;
}
    try {
        await navigator.clipboard.writeText(bindCodeResult.value.code);
        statusText.value = "Bind code copied.";
    } catch {
        statusText.value = "Copy failed.";
    }
}

async function onUpsert(): Promise<void> {
    const id = editForm.identityId.trim();
    if (!id) {
 statusText.value = "identity_id is required"; return; 
}
    busy.value = true;
    statusText.value = "";
    try {
        await upsertMagiIdentity({
            identityId: id,
            displayName: editForm.displayName.trim() || id,
            nickname: editForm.nickname.trim() || "",
            password: editForm.password,
            routeClass: editForm.routeClass,
            enabled: editForm.enabled,
            tokenExpiresSeconds: editForm.tokenExpires > 0 ? editForm.tokenExpires : undefined,
            channelBindings: editForm.channelBindings.length > 0 ? editForm.channelBindings : undefined,
        });
        statusText.value = `Identity [${id}] saved.`;
        if (!loginForm.identityId) {
            loginForm.identityId = id;
            loginForm.nickname = editForm.displayName.trim() || id;
        }
        editForm.password = "";
        await loadStats();
        await loadChannelsAndAccounts();
    } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        busy.value = false;
    }
}

async function onRemove(identityId: string): Promise<void> {
    busy.value = true;
    statusText.value = "";
    try {
        await removeMagiIdentity(identityId);
        statusText.value = `Removed [${identityId}].`;
        if (loginForm.identityId === identityId) {
            loginForm.identityId = state.identities[0]?.identityId ?? "";
        }
        await loadStats();
        await loadChannelsAndAccounts();
    } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        busy.value = false;
    }
}

async function onLogin(): Promise<void> {
    const id = loginForm.identityId.trim();
    const pw = loginForm.password.trim();
    if (!id || !pw) {
 statusText.value = "identity and password required"; return; 
}
    busy.value = true;
    statusText.value = "";
    try {
        const session = await loginMagiIdentity({
            identityId: id,
            password: pw,
            nickname: "",
            channel: loginForm.channel,
            activate: true,
            expiresInSeconds: loginForm.expiresIn > 0 ? loginForm.expiresIn : undefined,
        });
        statusText.value = `Session activated: ${session.identityId} (${session.channel})`;
        await loadStats();
        await loadChannelsAndAccounts();
    } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        busy.value = false;
    }
}

async function onCopyEndpoint(): Promise<void> {
    const url = apiEndpoint.value;
    if (!url) {
return;
}
    try {
        await navigator.clipboard.writeText(url);
        statusText.value = "Endpoint URL copied to clipboard.";
    } catch {
        statusText.value = "Failed to copy endpoint URL.";
    }
}

async function onCopyToken(): Promise<void> {
    const token = state.activeSession?.armorToken;
    if (!token) {
return;
}
    try {
        await navigator.clipboard.writeText(token);
        statusText.value = "Token copied to clipboard.";
    } catch {
        statusText.value = "Failed to copy token.";
    }
}

function onLogout(): void {
    clearActiveMagiArmorSession();
    statusText.value = "Session cleared.";
}

async function onIssueToken(identityId: string): Promise<void> {
    if (!issueForm.documentId.trim()) {
        dialogTarget.value = identityId;
        return;
    }
    busy.value = true;
    statusText.value = "";
    try {
        const session = await issueAvatarToken({
            identityId,
            channel: issueForm.channel,
            expiresInSeconds: issueForm.expiresIn > 0 ? issueForm.expiresIn : undefined,
            documentId: issueForm.documentId.trim() || undefined,
        });
        await navigator.clipboard.writeText(session.armorToken);
        statusText.value = `Avatar token for [${identityId}] copied to clipboard (${session.channel}).`;
        issuingId.value = "";
        await refreshMagiIdentities();
        await loadStats();
        await loadChannelsAndAccounts();
    } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        busy.value = false;
    }
}

function onConfirmWriteAvatar(identityId: string): void {
    const prompt = `请为 avatar 身份 [${identityId}] 在 AI 主笔记本中编写一份身份文档。`;
    window.dispatchEvent(new CustomEvent(MAGI_WRITE_AVATAR_EVENT, { detail: prompt }));
    dialogTarget.value = "";
    issuingId.value = "";
}

function toggleIssueForm(identityId: string): void {
    issuingId.value = issuingId.value === identityId ? "" : identityId;
}

async function handleIdentityRequired(): Promise<void> {
    statusText.value = "Main chat requires identity login.";
    panelRef.value?.scrollIntoView({ block: "start", behavior: "smooth" });
    if (attentionTimer) {
clearTimeout(attentionTimer);
}
    attention.value = true;
    attentionTimer = setTimeout(() => {
 attention.value = false; attentionTimer = null; 
}, 1800);
    await onRefresh();
}

onMounted(async () => {
    await onRefresh();
    window.addEventListener(MAGI_IDENTITY_REQUIRED_EVENT, handleIdentityRequired);
});

onBeforeUnmount(() => {
    window.removeEventListener(MAGI_IDENTITY_REQUIRED_EVENT, handleIdentityRequired);
    if (attentionTimer) {
clearTimeout(attentionTimer);
}
});
</script>
