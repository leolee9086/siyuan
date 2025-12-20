<template>
    <div class="fn__flex-column" style="height: 100%; overflow: auto;">
        <!-- Authentication Section -->
        <div class="b3-label">
            Authentication
            <div class="fn__hr"></div>

            <!-- Auth Profile Selector -->
            <div class="fn__flex config__item">
                <div class="fn__flex-1">
                    Profile
                </div>
                <select class="b3-select fn__flex-center fn__size200" v-model="currentAuthId"
                    @change="handleAuthChange">
                    <option v-for="p in authProfiles" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <span class="fn__space"></span>
                <button class="b3-button b3-button--outline fn__flex-center" @click="() => createAuthProfile()">
                    <svg>
                        <use xlink:href="#iconAdd"></use>
                    </svg>
                </button>
                <span class="fn__space"></span>
                <button class="b3-button b3-button--outline fn__flex-center" @click="() => deleteAuthProfile()"
                    :disabled="authProfiles.length <= 1">
                    <svg>
                        <use xlink:href="#iconTrashcan"></use>
                    </svg>
                </button>
            </div>

            <!-- Auth Fields -->
            <div v-if="currentAuthProfile">
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        API Token
                        <div class="b3-label__text">ModelScope API Token</div>
                    </div>
                    <div class="b3-form__icona fn__size200">
                        <input class="b3-text-field b3-form__icona-input" v-model="currentAuthProfile.data.apiToken"
                            @change="saveAuthProfile">
                    </div>
                </div>
            </div>
        </div>

        <!-- Generation Section -->
        <div class="b3-label">
            Generation Configuration
            <div class="fn__hr"></div>

            <!-- Gen Profile Selector -->
            <div class="fn__flex config__item">
                <div class="fn__flex-1">
                    Profile
                </div>
                <select class="b3-select fn__flex-center fn__size200" v-model="currentGenId" @change="handleGenChange">
                    <option v-for="p in genProfiles" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <span class="fn__space"></span>
                <button class="b3-button b3-button--outline fn__flex-center" @click="() => createGenProfile()">
                    <svg>
                        <use xlink:href="#iconAdd"></use>
                    </svg>
                </button>
                <span class="fn__space"></span>
                <button class="b3-button b3-button--outline fn__flex-center" @click="() => deleteGenProfile()"
                    :disabled="genProfiles.length <= 1">
                    <svg>
                        <use xlink:href="#iconTrashcan"></use>
                    </svg>
                </button>
            </div>

            <!-- Gen Fields -->
            <div v-if="currentGenProfile">
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        Model
                        <div class="b3-label__text">Model Name (e.g. modelscope/damo-text-to-image-synthesis)</div>
                    </div>
                    <input class="b3-text-field fn__size200" v-model="currentGenProfile.data.model"
                        @change="saveGenProfile">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        Width
                    </div>
                    <input type="number" class="b3-text-field fn__size200" v-model.number="currentGenProfile.data.width"
                        @change="saveGenProfile">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        Height
                    </div>
                    <input type="number" class="b3-text-field fn__size200"
                        v-model.number="currentGenProfile.data.height" @change="saveGenProfile">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        Steps
                    </div>
                    <input type="number" class="b3-text-field fn__size200" v-model.number="currentGenProfile.data.steps"
                        @change="saveGenProfile">
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSForgeConfigs } from "../sforge";
import { Profile } from "../profile.types";
import { confirmDialog } from "../../dialog/confirmDialog";

const authManager = getSForgeConfigs().ai.modelScope.auth;
const genManager = getSForgeConfigs().ai.modelScope.text2image;

const authProfiles = ref<Profile[]>([]);
const genProfiles = ref<Profile[]>([]);
const currentAuthId = ref("");
const currentGenId = ref("");
const currentAuthProfile = ref<Profile | null>(null);
const currentGenProfile = ref<Profile | null>(null);

const loadProfiles = async () => {
    console.log("loadProfiles: starting");
    await authManager.ensureNamespace();
    const authList = await authManager.listProfiles();
    console.log("loadProfiles: authList", authList);
    authProfiles.value = authList;
    let authId = await authManager.getActiveProfileId();
    if (!authId && authList.length > 0) authId = authList[0].id;
    currentAuthId.value = authId;
    await loadAuthProfile();

    await genManager.ensureNamespace();
    const genList = await genManager.listProfiles();
    console.log("loadProfiles: genList", genList);
    genProfiles.value = genList;
    let genId = await genManager.getActiveProfileId();
    if (!genId && genList.length > 0) genId = genList[0].id;
    currentGenId.value = genId;
    await loadGenProfile();
    console.log("loadProfiles: done");
};

const loadAuthProfile = async () => {
    if (!currentAuthId.value) {
        currentAuthProfile.value = null;
        return;
    }
    const p = await authManager.loadProfile(currentAuthId.value);
    currentAuthProfile.value = p;
    if (p) await authManager.setActiveProfileId(p.id);
};

const loadGenProfile = async () => {
    if (!currentGenId.value) {
        currentGenProfile.value = null;
        return;
    }
    const p = await genManager.loadProfile(currentGenId.value);
    currentGenProfile.value = p;
    if (p) await genManager.setActiveProfileId(p.id);
};

const handleAuthChange = async () => {
    await loadAuthProfile();
};

const handleGenChange = async () => {
    await loadGenProfile();
};

const createAuthProfile = async () => {
    try {
        console.log("createAuthProfile: starting");
        const name = `Profile ${authProfiles.value.length + 1}`;
        const newProfile = await authManager.createProfile(name, { apiToken: "" });
        console.log("createAuthProfile: created", newProfile);
        await loadProfiles();
        currentAuthId.value = newProfile.id;
        await loadAuthProfile();
        console.log("createAuthProfile: done");
    } catch (e) {
        console.error("Failed to create auth profile", e);
    }
};

const createGenProfile = async () => {
    try {
        console.log("createGenProfile: starting");
        const name = `Gen Config ${genProfiles.value.length + 1}`;
        const defaults = {
            model: "modelscope/damo-text-to-image-synthesis",
            width: 1024,
            height: 1024,
            steps: 50
        };
        const newProfile = await genManager.createProfile(name, defaults);
        console.log("createGenProfile: created", newProfile);
        await loadProfiles();
        currentGenId.value = newProfile.id;
        await loadGenProfile();
        console.log("createGenProfile: done");
    } catch (e) {
        console.error("Failed to create gen profile", e);
    }
};

const deleteAuthProfile = async () => {
    if (authProfiles.value.length <= 1 || !currentAuthId.value) return;
    confirmDialog("Delete Profile", "Are you sure you want to delete this profile?", async () => {
        await authManager.deleteProfile(currentAuthId.value);
        await loadProfiles();
        if (authProfiles.value.length > 0) {
            currentAuthId.value = authProfiles.value[0].id;
            await loadAuthProfile();
        } else {
            currentAuthId.value = "";
            currentAuthProfile.value = null;
        }
    });
};

const deleteGenProfile = async () => {
    if (genProfiles.value.length <= 1 || !currentGenId.value) return;
    confirmDialog("Delete Profile", "Are you sure you want to delete this profile?", async () => {
        await genManager.deleteProfile(currentGenId.value);
        await loadProfiles();
        if (genProfiles.value.length > 0) {
            currentGenId.value = genProfiles.value[0].id;
            await loadGenProfile();
        } else {
            currentGenId.value = "";
            currentGenProfile.value = null;
        }
    });
};

const saveAuthProfile = async () => {
    if (currentAuthProfile.value) {
        await authManager.saveProfile(currentAuthProfile.value);
    }
};

const saveGenProfile = async () => {
    if (currentGenProfile.value) {
        await genManager.saveProfile(currentGenProfile.value);
    }
};

onMounted(() => {
    loadProfiles();
});
</script>
