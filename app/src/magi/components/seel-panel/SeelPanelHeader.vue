<template>
    <div class="header-overlay">
        <div class="header-content">
            <div class="header-top">
                <div class="ai-id">
                    <span class="ai-icon">{{ icon }}</span>
                    <span class="ai-name">{{ nameParts[0] }}</span>
                    <span class="ai-number">-{{ nameParts[1] }}</span>
                </div>
                <div class="status-indicator">
                    <span class="status-led" :class="statusClass" />
                    <span class="status-text">{{ statusText }}</span>
                </div>
            </div>
            <div class="header-bottom">
                <span class="ai-role">{{ persona }}</span>
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

/** 将 "NAME-NUMBER" 拆分为 [名称, 编号] */
const nameParts = computed(() => props.configName.split("-"));
</script>
