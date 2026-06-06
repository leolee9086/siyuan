<template>
  <section class="extchan-container">
    <header class="extchan-header">
      <div class="extchan-title">EXTERNAL CHANNELS</div>
    </header>

    <div class="extchan-add-section">
      <div class="extchan-add-title">ADD CHANNEL</div>
      <div class="extchan-add-row">
        <select v-model="newChannelType" class="extchan-select extchan-add-select">
          <option value="wechat">WeChat (iLink)</option>
          <option value="discord" disabled>Discord (coming soon)</option>
          <option value="telegram" disabled>Telegram (coming soon)</option>
        </select>
        <button
          type="button"
          class="extchan-btn-add"
          :disabled="addingChannel"
          @click="onAddChannel"
        >
          {{ addingChannel ? "CONNECTING..." : "CONNECT" }}
        </button>
      </div>

      <div v-if="qrImgUrl" class="extchan-qr-section">
        <div class="extchan-qr-label">
          <span class="extchan-qr-status">{{ qrStatusText }}</span>
        </div>
        <p class="extchan-qr-hint">打开以下链接，用微信扫码授权：</p>
        <a :href="qrImgUrl" target="_blank" rel="noopener" class="extchan-qr-link">{{ qrImgUrl }}</a>
        <button type="button" class="extchan-btn-open" @click="onOpenQR">OPEN IN BROWSER</button>
        <button type="button" class="extchan-btn-cancel-qr" @click="onCancelQR">CANCEL</button>
      </div>
    </div>

    <div class="extchan-summary">
      <div
        v-for="ch in channels"
        :key="ch.id + ':' + ch.accountId"
        class="extchan-card"
        :class="{ 'extchan-card--connected': ch.connected, 'extchan-card--error': !!ch.error }"
      >
        <div class="extchan-card-head">
          <span class="extchan-card-id">{{ ch.id }}</span>
          <span class="extchan-card-badge" :class="ch.connected ? 'badge-ok' : 'badge-err'">
            {{ ch.connected ? "ONLINE" : "OFFLINE" }}
          </span>
        </div>
        <div class="extchan-card-body">
          <div class="extchan-card-row">
            <span class="extchan-card-label">Account</span>
            <span class="extchan-card-value">{{ ch.accountId || "-" }}</span>
          </div>
          <div class="extchan-card-row">
            <span class="extchan-card-label">Users</span>
            <span class="extchan-card-value">{{ ch.userCount }}</span>
          </div>
          <div class="extchan-card-row" v-if="ch.lastMessageAt">
            <span class="extchan-card-label">Last msg</span>
            <span class="extchan-card-value">{{ formatTime(ch.lastMessageAt) }}</span>
          </div>
          <div class="extchan-card-row" v-if="ch.error">
            <span class="extchan-card-label">Error</span>
            <span class="extchan-card-value extchan-error-text">{{ ch.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="extchan-config" v-if="trustConfig">
      <div class="extchan-config-title">TRUST CONFIGURATION</div>
      <div class="extchan-config-grid">
        <div v-for="(chanCfg, chanId) in (trustConfig.channels || {})" :key="chanId" class="extchan-config-card">
          <div class="extchan-config-card-head">
            <span class="extchan-config-card-id">{{ chanId }}</span>
            <label class="extchan-toggle">
              <input type="checkbox" :checked="chanCfg.enabled" @change="onToggleChannel(chanId, $event)" />
              <span>Enabled</span>
            </label>
          </div>
          <div class="extchan-config-grid-compact">
            <label class="extchan-label">TRUST
              <select class="extchan-select" :value="chanCfg.defaultTrust" @change="onChangeTrust(chanId, $event)">
                <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
              </select>
            </label>
            <label class="extchan-label">RISK
              <select class="extchan-select" :value="chanCfg.defaultRisk" @change="onChangeRisk(chanId, $event)">
                <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
              </select>
            </label>
          </div>
          <div v-if="Object.keys(chanCfg.perAccount || {}).length > 0" class="extchan-accounts">
            <div v-for="(acctCfg, acctId) in (chanCfg.perAccount || {})" :key="acctId" class="extchan-account-card">
              <div class="extchan-account-head">{{ acctId }}</div>
              <div class="extchan-account-info">
                trust={{ acctCfg.defaultTrust || chanCfg.defaultTrust }}
                risk={{ acctCfg.defaultRisk || chanCfg.defaultRisk }}
                allow={{ (acctCfg.allowList || []).length }} block={{ (acctCfg.blockList || []).length }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="extchan-config-actions">
        <button type="button" class="extchan-btn-save" :disabled="!configDirty" @click="onSaveConfig">
          {{ saving ? "SAVING..." : "SAVE CONFIG" }}
        </button>
        <button type="button" class="extchan-btn-refresh" @click="onRefresh">REFRESH</button>
      </div>
    </div>

    <div v-if="loading" class="extchan-loading">Loading...</div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { ChannelStatusView, ChannelTrustConfigView } from "../../service/magiExternalChannels";
import {
    listChannels, getTrustConfig, updateTrustConfig, createChannel, pollLoginStatus,
} from "../../service/magiExternalChannels";
import "./ExternalChannelsPanel.css";

const channels = ref<ChannelStatusView[]>([]);
const trustConfig = ref<ChannelTrustConfigView | null>(null);
const loading = ref(true);
const saving = ref(false);
const configDirty = ref(false);
const workingCopy = ref<ChannelTrustConfigView | null>(null);

const newChannelType = ref("wechat");
const addingChannel = ref(false);
const qrImgUrl = ref<string | null>(null);
const qrSessionKey = ref<string | null>(null);
const qrStatusText = ref("");
let qrPollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => loadData());
onUnmounted(() => stopQRPoll());

async function loadData(): Promise<void> {
    loading.value = true;
    try {
        const [ch, cfg] = await Promise.all([listChannels(), getTrustConfig()]);
        channels.value = ch.channels;
        trustConfig.value = cfg;
        workingCopy.value = JSON.parse(JSON.stringify(cfg));
        configDirty.value = false;
    } catch (err) {
 console.error("loadData error:", err); 
} finally {
 loading.value = false; 
}
}

function stopQRPoll(): void {
    if (qrPollTimer !== null) {
 clearInterval(qrPollTimer); qrPollTimer = null; 
}
}

function formatTime(iso: string): string {
    try {
 return new Date(iso).toLocaleTimeString(); 
} catch {
 return iso; 
}
}

async function onAddChannel(): Promise<void> {
    addingChannel.value = true;
    qrImgUrl.value = null;
    qrSessionKey.value = null;
    qrStatusText.value = "Fetching QR code...";
    stopQRPoll();
    try {
        const r = await createChannel(newChannelType.value);
        qrImgUrl.value = r.qrImgUrl;
        qrSessionKey.value = r.sessionKey;
        qrPollTimer = setInterval(async () => {
            if (!qrSessionKey.value) {
 stopQRPoll(); return; 
}
            try {
                const s = await pollLoginStatus(qrSessionKey.value!);
                if (s.status === "confirmed") {
 qrStatusText.value = "Online!"; stopQRPoll(); await loadData(); setTimeout(() => {
 qrImgUrl.value = null; 
}, 3000); 
} else if (s.status === "scaned") {
 qrStatusText.value = "Scanned! Confirm on phone..."; 
} else if (s.status === "wait") {
 qrStatusText.value = "Waiting for scan..."; 
} else if (s.status.startsWith("failed")) {
 qrStatusText.value = "Failed: " + s.status; stopQRPoll(); 
} else if (s.status === "done") {
 stopQRPoll(); await loadData(); qrImgUrl.value = null; 
}
            } catch {
 qrStatusText.value = "Waiting..."; 
}
        }, 2000);
    } catch (err: unknown) {
 qrStatusText.value = "Error: " + String(err); 
} finally {
 addingChannel.value = false; 
}
}

function onOpenQR(): void {
 if (qrImgUrl.value) {
 window.open(qrImgUrl.value, "_blank"); 
} 
}
function onCancelQR(): void {
 stopQRPoll(); qrImgUrl.value = null; qrSessionKey.value = null; 
}

function onToggleChannel(chanId: string, e: Event): void {
    const t = e.target; if (!(t instanceof HTMLInputElement) || !workingCopy.value) {
return;
}
    const c = workingCopy.value.channels[chanId]; if (c) {
 c.enabled = t.checked; configDirty.value = true; 
}
}

function onChangeTrust(chanId: string, e: Event): void {
    const t = e.target; if (!(t instanceof HTMLSelectElement) || !workingCopy.value) {
return;
}
    const c = workingCopy.value.channels[chanId]; if (c) {
 c.defaultTrust = t.value as any; configDirty.value = true; 
}
}

function onChangeRisk(chanId: string, e: Event): void {
    const t = e.target; if (!(t instanceof HTMLSelectElement) || !workingCopy.value) {
return;
}
    const c = workingCopy.value.channels[chanId]; if (c) {
 c.defaultRisk = t.value as any; configDirty.value = true; 
}
}

async function onSaveConfig(): Promise<void> {
    if (!workingCopy.value) {
return;
}
    saving.value = true;
    try {
 await updateTrustConfig(workingCopy.value); trustConfig.value = JSON.parse(JSON.stringify(workingCopy.value)); configDirty.value = false; 
} catch { /* */ } finally {
 saving.value = false; 
}
}

async function onRefresh(): Promise<void> {
 await loadData(); 
}
</script>
