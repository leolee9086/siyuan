<template>
    <div v-if="i18nReady" class="fn__flex-column" style="height: 100%; overflow: auto;">
        <!-- Authentication Section -->
        <div class="b3-label">
            {{ i18n.modelScope.auth.标题 }}
            <div class="fn__hr"></div>

            <!-- Auth Profile Selector -->
            <div class="fn__flex config__item">
                <div class="fn__flex-1">
                    {{ i18n.modelScope.auth.配置档案 }}
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
                        {{ i18n.modelScope.auth.配置名称 }}
                        <div class="b3-label__text">{{ i18n.modelScope.auth.配置名称提示 }}</div>
                    </div>
                    <input class="b3-text-field fn__size200" v-model="currentAuthProfile.name"
                        @change="saveAuthProfile">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        {{ i18n.modelScope.auth.apiToken }}
                        <div class="b3-label__text">{{ i18n.modelScope.auth.apiTokenTip }}</div>
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
            {{ i18n.modelScope.text2image.标题 }}
            <div class="fn__hr"></div>

            <!-- Gen Profile Selector -->
            <div class="fn__flex config__item">
                <div class="fn__flex-1">
                    {{ i18n.modelScope.auth.配置档案 }}
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
                        {{ i18n.modelScope.auth.配置名称 }}
                        <div class="b3-label__text">{{ i18n.modelScope.auth.配置名称提示 }}</div>
                    </div>
                    <input class="b3-text-field fn__size200" v-model="currentGenProfile.name" @change="saveGenProfile">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        {{ i18n.modelScope.text2image.模型 }}
                        <div class="b3-label__text">{{ i18n.modelScope.text2image.模型提示 }}</div>
                    </div>
                    <input class="b3-text-field fn__size200" v-model="currentGenProfile.data.model"
                        @change="saveGenProfile">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        {{ i18n.modelScope.text2image.宽度 }}
                    </div>
                    <input type="number" class="b3-text-field fn__size200" v-model.number="currentGenProfile.data.width"
                        @change="saveGenProfile">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        {{ i18n.modelScope.text2image.高度 }}
                    </div>
                    <input type="number" class="b3-text-field fn__size200"
                        v-model.number="currentGenProfile.data.height" @change="saveGenProfile">
                </div>
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        {{ i18n.modelScope.text2image.步数 }}
                    </div>
                    <input type="number" class="b3-text-field fn__size200" v-model.number="currentGenProfile.data.steps"
                        @change="saveGenProfile">
                </div>
            </div>
        </div>

        <!-- Test Section -->
        <div class="b3-label">
            {{ i18n.modelScope.test.标题 }}
            <div class="fn__hr"></div>

            <!-- Prompt Input -->
            <div class="fn__flex b3-label config__item">
                <div class="fn__flex-1">
                    {{ i18n.modelScope.test.提示词 }}
                    <div class="b3-label__text">{{ i18n.modelScope.test.提示词说明 }}</div>
                </div>
                <input class="b3-text-field fn__size200" v-model="testPrompt" placeholder="a cute cat">
            </div>

            <!-- Test Button and Status -->
            <div class="fn__flex b3-label config__item">
                <div class="fn__flex-1">
                    {{ i18n.modelScope.test.状态 }}
                    <div class="b3-label__text">{{ testStatusMessage }}</div>
                </div>
                <button class="b3-button b3-button--outline fn__flex-center fn__size200" @click="handleTestGeneration"
                    :disabled="testLoading">
                    {{ testLoading ? i18n.modelScope.test.生成中 : i18n.modelScope.test.测试生成 }}
                </button>
            </div>

            <!-- Result Image -->
            <div v-if="testResultImage" class="fn__flex b3-label config__item">
                <div class="fn__block" style="text-align: center;">
                    <img :src="testResultImage" alt="Generated Image"
                        style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
                </div>
            </div>

            <!-- Error Message -->
            <div v-if="testError" class="fn__flex b3-label config__item">
                <div class="fn__block ft__error" style="color: var(--b3-theme-error);">
                    {{ testError }}
                </div>
            </div>
        </div>
    </div>
    <div v-else class="fn__flex-center" style="height: 100%;">
        加载中...
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, shallowRef } from "vue";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { forgeI18n, loadForgeI18n } from "../../util/siyuanEnvironments/forgeI18n.getI18n.environment";
import { getSForgeConfigs } from "../sforge";
import { Profile } from "../profile.types";
import { confirmDialog } from "../../dialog/confirmDialog";
import {
    提交生成任务,
    轮询任务直到完成,
    获取图片,
    提取图片URL
} from "../../apis/modelscope";

// 使用 shallowRef 包裹 forgeI18n，在组件挂载时会触发更新
const i18n = shallowRef(forgeI18n);
const i18nReady = ref(false);

const authManager = getSForgeConfigs().ai.modelScope.auth;
const genManager = getSForgeConfigs().ai.modelScope.text2image;

const authProfiles = ref<Profile[]>([]);
const genProfiles = ref<Profile[]>([]);
const currentAuthId = ref("");
const currentGenId = ref("");
const currentAuthProfile = ref<Profile | null>(null);
const currentGenProfile = ref<Profile | null>(null);

// Test generation state
const testPrompt = ref("a cute cat");
const testLoading = ref(false);
const testStatusMessage = ref("Ready to test");
const testResultImage = ref<string | null>(null);
const testError = ref<string | null>(null);

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
        // Refresh list to update dropdown display
        const authList = await authManager.listProfiles();
        authProfiles.value = authList;
    }
};

const saveGenProfile = async () => {
    if (currentGenProfile.value) {
        await genManager.saveProfile(currentGenProfile.value);
        // Refresh list to update dropdown display
        const genList = await genManager.listProfiles();
        genProfiles.value = genList;
    }
};

// Test generation handler
const handleTestGeneration = async () => {
    if (!currentAuthProfile.value?.data?.apiToken) {
        testError.value = "Please configure an API Token first";
        return;
    }
    if (!testPrompt.value.trim()) {
        testError.value = "Please enter a prompt";
        return;
    }

    testLoading.value = true;
    testError.value = null;
    testResultImage.value = null;
    testStatusMessage.value = "Submitting task...";

    try {
        // Build generation params from current profile
        const genData = currentGenProfile.value?.data || {};
        const params = {
            model: genData.model || undefined,
            width: genData.width || undefined,
            height: genData.height || undefined,
            steps: genData.steps || undefined
        };

        // Submit task
        const taskId = await 提交生成任务({
            apiToken: currentAuthProfile.value.data.apiToken,
            prompt: testPrompt.value,
            params
        });
        testStatusMessage.value = `Task submitted: ${taskId.substring(0, 8)}... Polling...`;

        // Poll until complete
        const status = await 轮询任务直到完成({
            apiToken: currentAuthProfile.value.data.apiToken,
            taskId
        });

        if (status.task_status === "FAILED") {
            throw new Error(status.error?.message || "Generation failed");
        }

        testStatusMessage.value = "Fetching image...";

        // Get image URL and fetch
        const imageUrl = 提取图片URL(status);
        if (!imageUrl) {
            throw new Error("No image URL in response");
        }

        const base64Image = await 获取图片({ imageUrl });
        testResultImage.value = base64Image;
        testStatusMessage.value = "Generation complete!";
    } catch (e) {
        console.error("Test generation failed:", e);
        testError.value = e instanceof Error ? e.message : "Unknown error";
        testStatusMessage.value = "Generation failed";
    } finally {
        testLoading.value = false;
    }
};

onMounted(async () => {
    // 确保翻译已加载
    await loadForgeI18n();
    i18n.value = forgeI18n;
    i18nReady.value = true;
    loadProfiles();
});
</script>
