<template>
    <div class="fn__flex-column fn__flex-center" style="padding: 20px; text-align: center; min-width: 300px;">
        <div v-if="loading" style="width: 40px; height: 40px; margin-bottom: 16px;">
            <svg class="fn__rotate" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
                width="100%" height="100%">
                <path
                    d="M512 64c247.4 0 448 200.6 448 448s-200.6 448-448 448S64 759.4 64 512 264.6 64 512 64m0-64C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0z"
                    style="fill: var(--b3-theme-on-surface-light)"></path>
                <path d="M512 64c247.4 0 448 200.6 448 448h-64c0-212.1-171.9-384-384-384V64z"
                    style="fill: var(--b3-theme-primary)">
                    <animateTransform attributeName="transform" type="rotate" from="0 512 512" to="360 512 512" dur="1s"
                        repeatCount="indefinite"></animateTransform>
                </path>
            </svg>
        </div>
        <div class="ft__on-surface" style="font-size: 14px;">{{ message }}</div>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const message = ref("准备开始生成...");
const loading = ref(true);

const updateStatus = (msg: string, isLoading: boolean = true) => {
    message.value = msg;
    loading.value = isLoading;
};

defineExpose({
    updateStatus
});
</script>
