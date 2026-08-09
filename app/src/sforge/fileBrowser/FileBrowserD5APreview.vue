<template>
    <section class="sforge-d5a-preview" aria-label="D5A / D5Mesh 结构预览">
        <header :class="['sforge-d5a-preview__status', statusClass]">
            <strong>{{ statusLabel }}</strong>
            <span>{{ report.elapsedMs.toFixed(1) }} ms</span>
        </header>
        <template v-if="report.d5a">
            <dl class="sforge-d5a-preview__stats">
                <div><dt>容器变体</dt><dd>{{ report.d5a.variant }}</dd></div>
                <div><dt>文件条目</dt><dd>{{ report.d5a.fileEntryCount }} / {{ report.d5a.entryCount }}</dd></div>
                <div><dt>模型包</dt><dd>{{ report.d5a.bundles.length }}</dd></div>
                <div><dt>加密条目</dt><dd>{{ report.d5a.encryptedEntryCount }}</dd></div>
            </dl>
            <section v-for="bundle in report.d5a.bundles" :key="`${bundle.id}:${bundle.meshEntry}`"
                class="sforge-d5a-preview__bundle">
                <header>
                    <strong>{{ bundle.meshEntry }}</strong>
                    <span>{{ bundle.status }}</span>
                </header>
                <dl v-if="bundle.mesh" class="sforge-d5a-preview__mesh">
                    <div><dt>D5Mesh</dt><dd>v{{ bundle.mesh.version }}</dd></div>
                    <div><dt>三角面</dt><dd>{{ formatCount(bundle.mesh.triangleCount) }}</dd></div>
                    <div><dt>顶点</dt><dd>{{ formatCount(bundle.mesh.vertexCount) }}</dd></div>
                    <div><dt>组 / 描述符</dt><dd>{{ bundle.mesh.geometryGroupCount }} / {{ bundle.mesh.descriptorCount }}</dd></div>
                </dl>
                <p v-if="bundle.material" class="sforge-d5a-preview__material">
                    {{ bundle.material.title || "未命名材质" }} · {{ bundle.material.materialCount }} 个材质 ·
                    {{ bundle.material.textureReferenceCount }} 个纹理引用
                </p>
                <ul v-if="bundle.warnings.length" class="sforge-d5a-preview__warnings">
                    <li v-for="warning in bundle.warnings" :key="warning">{{ warning }}</li>
                </ul>
            </section>
        </template>
        <ul v-if="report.warnings.length" class="sforge-d5a-preview__warnings">
            <li v-for="warning in report.warnings" :key="warning">{{ warning }}</li>
        </ul>
        <p v-if="!report.d5a && !report.warnings.length" class="sforge-d5a-preview__empty">报告未包含 D5A 容器数据</p>
    </section>
</template>

<script setup lang="ts">
import {computed} from "vue";
import type {FileBrowserD5AInspectionReport} from "./FileBrowser.types";

const props = defineProps<{report: FileBrowserD5AInspectionReport}>();

const statusLabel = computed(() => {
    switch (props.report.status) {
        case "pass": return "解析完成";
        case "warning": return "解析完成，有警告";
        case "unsupported": return "格式受限";
        case "fail": return "解析失败";
        default: return props.report.status;
    }
});

const statusClass = computed(() => props.report.status === "unsupported" || props.report.status === "fail"
    ? "sforge-d5a-preview__status--error" : "");

function formatCount(value: number) {
    return Math.round(value).toLocaleString("zh-CN");
}
</script>
