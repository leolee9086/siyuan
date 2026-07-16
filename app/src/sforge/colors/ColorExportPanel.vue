<template>
    <section class="sforge-color-tool__section">
        <div v-if="previewUrl" class="sforge-color-tool__preview">
            <img :src="previewUrl" alt="色卡预览" />
            <div class="sforge-color-tool__toolbar">
                <input v-model="cardTitle" class="b3-text-field" placeholder="色卡标题" @change="更新预览" />
                <select v-model="cardLayout" class="b3-select" @change="更新预览">
                    <option value="default">原始色卡</option>
                    <option value="left">左侧标签</option>
                    <option value="right">右侧标签</option>
                    <option value="round">圆形色卡</option>
                    <option value="gradient">渐变色卡</option>
                </select>
                <button class="b3-button b3-button--text" @click="导出结果(selectedExportColors)">导出 PNG</button>
            </div>
            <div class="sforge-color-tool__export-labels">
                <label v-for="(item, index) in selectedExportColors" :key="`${item.rgb.join('-')}-${index}`">
                    {{ rgbToHex(item.rgb) }}
                    <input v-model="item.name" class="b3-text-field" placeholder="颜色名称" @change="更新预览" />
                </label>
            </div>
        </div>
        <div v-else class="sforge-color-tool__empty sforge-color-tool__empty--large">先在图片分析中选择一组颜色</div>
    </section>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：颜色工具控制器类型；使用范围：导出面板 props；解耦评估：仅类型导入，不产生运行时依赖。 */
import type {useColorTool} from "./useColorTool";

const props = defineProps<{tool: ReturnType<typeof useColorTool>}>();
const {previewUrl, cardTitle, cardLayout, selectedExportColors, rgbToHex, 更新预览, 导出结果} = props.tool;
</script>
