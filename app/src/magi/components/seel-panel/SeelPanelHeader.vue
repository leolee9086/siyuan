<template>
    <div class="header-overlay">
        <div class="header-content">
            <div class="header-top" :class="{ 'header-top-trinity': isTrinity }">
                <div class="header-mainline" :class="{ 'header-mainline-trinity': isTrinity }">
                    <div class="ai-id" :class="{ 'ai-id-trinity': isTrinity }">
                        <span v-if="!isTrinity" class="ai-icon">{{ icon }}</span>
                        <span class="ai-name" :class="{ 'ai-name-trinity': isTrinity }">{{ displayName }}</span>
                        <span v-if="displayNumber" class="ai-number">-{{ displayNumber }}</span>
                    </div>
                    <span class="ai-role">{{ persona }}</span>
                </div>
                <div class="status-indicator">
                    <span class="status-led" :class="statusClass" />
                    <span class="status-text">{{ statusText }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
    /** 贤者图标字符 */
    icon: string;
    /** 贤者配置名称（格式: "NAME-NUMBER"） */
    configName: string;
    /** 人格描述 */
    persona: string;
    /** 连接状态CSS类名 */
    statusClass: string;
    /** 连接状态显示文本 */
    statusText: string;
}>();

const isTrinity = computed(() => props.configName.toUpperCase().includes("TRINITY"));

const displayName = computed(() => {
    if (isTrinity.value) {
        return "MAGI";
    }
    return props.configName.split("-")[0] ?? props.configName;
});

const displayNumber = computed(() => {
    if (isTrinity.value) {
        return "";
    }
    return props.configName.split("-")[1] ?? "";
});
</script>
