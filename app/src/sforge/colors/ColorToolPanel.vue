<template>
    <div class="sforge-color-tool" @paste.prevent="tool.处理粘贴图片">
        <header class="sforge-color-tool__header">
            <div>
                <strong>颜色工具</strong>
                <span class="sforge-color-tool__subtitle">TEColors · s-forge 内建</span>
            </div>
            <button v-if="!props.embedded" class="b3-button b3-button--cancel" @click="$emit('close')">关闭</button>
        </header>

        <nav class="sforge-color-tool__tabs" aria-label="颜色工具区域">
            <button v-for="item in tool.tabs" :key="item.id" class="sforge-color-tool__tab"
                :class="{ 'sforge-color-tool__tab--active': activeTab === item.id }" @click="activeTab = item.id">
                {{ item.label }}
            </button>
        </nav>

        <main class="sforge-color-tool__body">
            <ApplyColorPanel v-if="activeTab === 'apply'" :tool="tool" />
            <ImageColorPanel v-else-if="activeTab === 'image'" :tool="tool" />
            <ColorExportPanel v-else :tool="tool" />
        </main>
    </div>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：颜色工具状态控制器；使用范围：主容器创建并传递给子面板；解耦评估：业务状态集中在 composable，组件只负责布局。 */
import {useColorTool} from "./useColorTool";
/** 用途：颜色应用子面板；使用范围：apply 页签；解耦评估：应用 UI 与图片/导出 UI 分开演进。 */
import ApplyColorPanel from "./ApplyColorPanel.vue";
/** 用途：图片取色子面板；使用范围：image 页签；解耦评估：图片输入和算法展示隔离。 */
import ImageColorPanel from "./ImageColorPanel.vue";
/** 用途：色卡导出子面板；使用范围：export 页签；解耦评估：画布预览和工作区导出隔离。 */
import ColorExportPanel from "./ColorExportPanel.vue";

const props = defineProps<{initialImageSrc?: string; embedded?: boolean}>();
defineEmits<{(event: "close"): void}>();
const tool = useColorTool(props.initialImageSrc);
const activeTab = tool.activeTab;
</script>
