<template>
    <div v-if="loaded" class="fn__flex-column" style="height: 100%; overflow: auto;">
        <div class="b3-label">
            AI Profiles
            <div class="fn__hr"></div>

            <div class="fn__flex config__item">
                <div class="fn__flex-1">Active Profile</div>
                <select class="b3-select fn__flex-center fn__size200" v-model="activeId" @change="handleSwitch">
                    <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.label || p.name }}</option>
                </select>
                <span class="fn__space"></span>
                <button class="b3-button b3-button--outline fn__flex-center" @click="handleCreate">
                    <svg><use xlink:href="#iconAdd"></use></svg>
                </button>
                <span class="fn__space"></span>
                <button class="b3-button b3-button--outline fn__flex-center" @click="handleDelete"
                    :disabled="profiles.length <= 1">
                    <svg><use xlink:href="#iconTrashcan"></use></svg>
                </button>
            </div>

            <div v-if="current" class="fn__flex-column">
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">Name</div>
                    <input class="b3-text-field fn__size200" v-model="current.name" @change="handleSave">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">Label</div>
                    <input class="b3-text-field fn__size200" v-model="current.label" @change="handleSave">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">Provider</div>
                    <select class="b3-select fn__flex-center fn__size200" v-model="current.provider" @change="handleSave">
                        <option value="OpenAI">OpenAI</option>
                        <option value="Azure">Azure</option>
                        <option value="Claude">Claude</option>
                        <option value="Ollama">Ollama</option>
                    </select>
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">API Key</div>
                    <input class="b3-text-field fn__size200" v-model="current.apiKey" @change="handleSave">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">Base URL</div>
                    <input class="b3-text-field fn__size200" v-model="current.baseUrl" @change="handleSave">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">Model</div>
                    <input class="b3-text-field fn__size200" v-model="current.model" @change="handleSave">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">Max Tokens</div>
                    <input type="number" class="b3-text-field fn__size200" v-model.number="current.maxTokens" @change="handleSave">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">Temperature</div>
                    <input type="number" step="0.1" class="b3-text-field fn__size200" v-model.number="current.temperature" @change="handleSave">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">超时时间（秒）</div>
                    <input type="number" class="b3-text-field fn__size200" v-model.number="timeoutSeconds" @change="handleSave">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">API Proxy</div>
                    <input class="b3-text-field fn__size200" v-model="current.apiProxy" @change="handleSave">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">Priority</div>
                    <input type="number" class="b3-text-field fn__size200" v-model.number="current.priority" @change="handleSave">
                </div>
            </div>
        </div>
    </div>
    <div v-else class="fn__flex-center" style="height: 100%;">Loading...</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { fetchSyncPost } from "../../util/network/fetch";
import { confirmDialog } from "../../dialog/confirmDialog";

interface ProfileModel {
    id: string;
    model: string;
    capabilities: string;
    enabled: boolean;
}

interface Profile {
    id: string;
    name: string;
    label: string;
    provider: string;
    apiKey: string;
    baseUrl: string;
    apiProxy: string;
    apiVersion: string;
    model: string;
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
    priority: number;
    enabled: boolean;
    models: ProfileModel[];
}

const loaded = ref(false);
const profiles = ref<Profile[]>([]);
const activeId = ref("");
const current = ref<Profile | null>(null);

const timeoutSeconds = computed({
    get: () => current.value ? Math.round(current.value.timeoutMs / 1000) : 30,
    set: (val: number) => {
 if (current.value) {
current.value.timeoutMs = val * 1000;
} 
},
});

const loadProfiles = async () => {
    const resp: any = await fetchSyncPost("/api/s-forge/ai/profile/list", {});
    const data = resp.data || resp;
    profiles.value = data.profiles || [];
    activeId.value = data.active || "";
    if (activeId.value) {
        const found = profiles.value.find((p: Profile) => p.id === activeId.value);
        current.value = found ? { ...found } : null;
    } else if (profiles.value.length > 0) {
        current.value = { ...profiles.value[0] };
    } else {
        current.value = null;
    }
};

const handleSwitch = async () => {
    await fetchSyncPost("/api/s-forge/ai/profile/switch", { id: activeId.value });
    await loadProfiles();
};

const handleCreate = async () => {
    const p: Profile = {
        id: "",
        name: "Profile " + (profiles.value.length + 1),
        label: "",
        provider: "OpenAI",
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        apiProxy: "",
        apiVersion: "",
        model: "gpt-3.5-turbo",
        maxTokens: 0,
        temperature: 1.0,
        timeoutMs: 120000,
        priority: 0,
        enabled: true,
        models: [],
    };
    const resp: any = await fetchSyncPost("/api/s-forge/ai/profile/upsert", p);
    await loadProfiles();
    if (resp && resp.data && resp.data.profile) {
        activeId.value = resp.data.profile.id;
    }
};

const handleDelete = async () => {
    if (!current.value || profiles.value.length <= 1) {
return;
}
    confirmDialog("Delete Profile", "Are you sure?", async () => {
        await fetchSyncPost("/api/s-forge/ai/profile/delete", { id: current.value!.id });
        await loadProfiles();
    });
};

const handleSave = async () => {
    if (!current.value) {
return;
}
    await fetchSyncPost("/api/s-forge/ai/profile/upsert", current.value);
    await loadProfiles();
};

onMounted(async () => {
    await loadProfiles();
    loaded.value = true;
});
</script>
