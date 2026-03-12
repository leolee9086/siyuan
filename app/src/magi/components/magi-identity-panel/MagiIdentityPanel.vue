<template>
  <section
    ref="panelRef"
    class="magi-identity-panel"
    :class="{ 'magi-identity-panel--attention': attention }"
  >
    <header class="magi-identity-panel__header">
      <div class="magi-identity-panel__title">IDENTITY ACCESS CONTROL</div>
      <button
        type="button"
        class="magi-identity-panel__refresh"
        :disabled="state.loading"
        @click="onRefresh"
      >
        {{ state.loading ? "REFRESHING..." : "REFRESH" }}
      </button>
    </header>

    <div class="magi-identity-panel__content">
      <section class="magi-identity-panel__block">
        <div class="magi-identity-panel__block-title">MAIN PANEL SESSION</div>
        <div v-if="state.activeSession" class="magi-identity-panel__session">
          <div>ID: {{ state.activeSession.identityId }}</div>
          <div>NICK: {{ state.activeSession.nickname }}</div>
          <div>ROUTE: {{ state.activeSession.routeClass }}</div>
          <div>CHANNEL: {{ state.activeSession.channel }}</div>
          <div>EXPIRES: {{ formatExpireAt(state.activeSession.expiresAt) }}</div>
          <button type="button" class="magi-identity-panel__danger" @click="onLogoutMainSession">
            LOGOUT SESSION
          </button>
        </div>
        <div v-else class="magi-identity-panel__hint">
          No active MAGI armor session.
        </div>
      </section>

      <section class="magi-identity-panel__block">
        <div class="magi-identity-panel__block-title">LOGIN (MAIN CHAT)</div>
        <label class="magi-identity-panel__label">
          IDENTITY
          <select v-model="loginForm.identityId" class="magi-identity-panel__select">
            <option v-for="identity in state.identities" :key="identity.identityId" :value="identity.identityId">
              {{ identity.identityId }} | {{ identity.routeClass }}
            </option>
          </select>
        </label>
        <label class="magi-identity-panel__label">
          PASSWORD
          <input v-model="loginForm.password" class="magi-identity-panel__input" type="password" />
        </label>
        <label class="magi-identity-panel__label">
          NICKNAME
          <input v-model="loginForm.nickname" class="magi-identity-panel__input" type="text" />
        </label>
        <label class="magi-identity-panel__label">
          CHANNEL
          <select v-model="loginForm.channel" class="magi-identity-panel__select">
            <option v-for="channel in channelOptions" :key="channel" :value="channel">
              {{ channel }}
            </option>
          </select>
        </label>
        <button type="button" class="magi-identity-panel__primary" :disabled="busy" @click="onLoginMainSession">
          LOGIN & ACTIVATE
        </button>
      </section>

      <section class="magi-identity-panel__block magi-identity-panel__block--wide">
        <div class="magi-identity-panel__block-title">IDENTITY MANAGEMENT</div>
        <div class="magi-identity-panel__grid">
          <label class="magi-identity-panel__label">
            IDENTITY ID
            <input v-model="editForm.identityId" class="magi-identity-panel__input" type="text" />
          </label>
          <label class="magi-identity-panel__label">
            DISPLAY NAME
            <input v-model="editForm.displayName" class="magi-identity-panel__input" type="text" />
          </label>
          <label class="magi-identity-panel__label">
            PASSWORD (OPTIONAL FOR UPDATE)
            <input v-model="editForm.password" class="magi-identity-panel__input" type="password" />
          </label>
          <label class="magi-identity-panel__label">
            ROUTE CLASS
            <select v-model="editForm.routeClass" class="magi-identity-panel__select">
              <option value="guardian">guardian</option>
              <option value="avatar-only">avatar-only</option>
            </select>
          </label>
          <label class="magi-identity-panel__check">
            <input v-model="editForm.enabled" type="checkbox" />
            ENABLED
          </label>
        </div>
        <div class="magi-identity-panel__actions">
          <button type="button" class="magi-identity-panel__primary" :disabled="busy" @click="onUpsertIdentity">
            SAVE IDENTITY
          </button>
          <button type="button" class="magi-identity-panel__neutral" :disabled="busy" @click="resetEditForm">
            RESET
          </button>
        </div>

        <div class="magi-identity-panel__list">
          <article
            v-for="identity in state.identities"
            :key="identity.identityId"
            class="magi-identity-panel__item"
          >
            <div class="magi-identity-panel__item-main">
              <div class="magi-identity-panel__item-id">{{ identity.identityId }}</div>
              <div class="magi-identity-panel__item-meta">
                {{ identity.displayName }} | {{ identity.routeClass }} | {{ identity.enabled ? "enabled" : "disabled" }}
              </div>
            </div>
            <div class="magi-identity-panel__item-actions">
              <button type="button" class="magi-identity-panel__neutral" @click="applyIdentityToEditForm(identity)">
                EDIT
              </button>
              <button type="button" class="magi-identity-panel__danger" :disabled="busy" @click="onRemoveIdentity(identity.identityId)">
                REMOVE
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <div v-if="statusText" class="magi-identity-panel__status">{{ statusText }}</div>
    <div v-if="state.lastError" class="magi-identity-panel__error">{{ state.lastError }}</div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import type { MagiIdentityView, MagiRequestChannel } from "../../service/magiIdentitySession";
import {
    clearActiveMagiArmorSession,
    loginMagiIdentity,
    MAGI_IDENTITY_REQUIRED_EVENT,
    refreshMagiIdentities,
    removeMagiIdentity,
    upsertMagiIdentity,
    useMagiIdentitySessionState,
} from "../../service/magiIdentitySession";
import "./MagiIdentityPanel.css";

const state = useMagiIdentitySessionState();
const busy = ref(false);
const statusText = ref("");
const attention = ref(false);
const panelRef = ref<HTMLElement | null>(null);
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
    nickname: "",
    channel: "magi-main-ui" as MagiRequestChannel,
});

const editForm = reactive({
    identityId: "",
    displayName: "",
    password: "",
    routeClass: "avatar-only" as "guardian" | "avatar-only",
    enabled: true,
});

function formatExpireAt(timestamp: number): string {
    if (!timestamp) {
        return "-";
    }
    return new Date(timestamp).toLocaleString();
}

function applyIdentityToEditForm(identity: MagiIdentityView): void {
    editForm.identityId = identity.identityId;
    editForm.displayName = identity.displayName;
    editForm.password = "";
    editForm.routeClass = identity.routeClass;
    editForm.enabled = identity.enabled;
}

function resetEditForm(): void {
    editForm.identityId = "";
    editForm.displayName = "";
    editForm.password = "";
    editForm.routeClass = "avatar-only";
    editForm.enabled = true;
}

async function onRefresh(): Promise<void> {
    busy.value = true;
    statusText.value = "";
    try {
        await refreshMagiIdentities();
        if (!loginForm.identityId && state.identities.length > 0) {
            const first = state.identities[0];
            if (first) {
                loginForm.identityId = first.identityId;
                loginForm.nickname = first.displayName;
            }
        }
        statusText.value = "Identity list refreshed.";
    } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        busy.value = false;
    }
}

async function onUpsertIdentity(): Promise<void> {
    const identityId = editForm.identityId.trim();
    if (!identityId) {
        statusText.value = "identity id is required";
        return;
    }
    busy.value = true;
    statusText.value = "";
    try {
        await upsertMagiIdentity({
            identityId,
            displayName: editForm.displayName.trim() || identityId,
            password: editForm.password,
            routeClass: editForm.routeClass,
            enabled: editForm.enabled,
        });
        statusText.value = `Identity [${identityId}] saved.`;
        if (!loginForm.identityId) {
            loginForm.identityId = identityId;
            loginForm.nickname = editForm.displayName.trim() || identityId;
        }
        editForm.password = "";
    } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        busy.value = false;
    }
}

async function onRemoveIdentity(identityId: string): Promise<void> {
    busy.value = true;
    statusText.value = "";
    try {
        await removeMagiIdentity(identityId);
        statusText.value = `Identity [${identityId}] removed.`;
        if (loginForm.identityId === identityId) {
            loginForm.identityId = state.identities[0]?.identityId ?? "";
        }
    } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        busy.value = false;
    }
}

async function onLoginMainSession(): Promise<void> {
    const identityId = loginForm.identityId.trim();
    const password = loginForm.password.trim();
    if (!identityId || !password) {
        statusText.value = "identity and password are required for login";
        return;
    }
    busy.value = true;
    statusText.value = "";
    try {
        const nickname = loginForm.nickname.trim() || identityId;
        const session = await loginMagiIdentity({
            identityId,
            password,
            nickname,
            channel: loginForm.channel,
            activate: true,
        });
        statusText.value = `Main session activated: ${session.identityId} (${session.channel})`;
    } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error);
    } finally {
        busy.value = false;
    }
}

function onLogoutMainSession(): void {
    clearActiveMagiArmorSession();
    statusText.value = "Main panel session cleared.";
}

async function handleIdentityRequiredEvent(_event: Event): Promise<void> {
    statusText.value = "Main chat requires identity login. Please login here first.";
    panelRef.value?.scrollIntoView({
        block: "start",
        behavior: "smooth",
    });
    if (attentionTimer) {
        clearTimeout(attentionTimer);
        attentionTimer = null;
    }
    attention.value = true;
    attentionTimer = setTimeout(() => {
        attention.value = false;
        attentionTimer = null;
    }, 1800);
    await onRefresh();
}

onMounted(async () => {
    await onRefresh();
    window.addEventListener(MAGI_IDENTITY_REQUIRED_EVENT, handleIdentityRequiredEvent);
});

onBeforeUnmount(() => {
    window.removeEventListener(MAGI_IDENTITY_REQUIRED_EVENT, handleIdentityRequiredEvent);
    if (attentionTimer) {
        clearTimeout(attentionTimer);
        attentionTimer = null;
    }
});
</script>
