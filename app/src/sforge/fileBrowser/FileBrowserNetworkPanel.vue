<template>
    <section class="sforge-file-network" :aria-busy="loading">
        <header class="sforge-file-network__header">
            <svg class="sforge-file-network__icon" aria-hidden="true"><use href="#iconGlobe" /></svg>
            <div class="sforge-file-network__identity">
                <strong :title="documentData?.name ?? file.name">{{ documentData?.name ?? file.name }}</strong>
                <span :title="file.uri">{{ file.uri }}</span>
            </div>
            <span v-if="documentData" class="sforge-file-network__language">
                {{ documentData.language || "未识别语言" }}
            </span>
            <span class="sforge-file-network__readonly">只读</span>
        </header>
        <main class="sforge-file-network__content">
            <div ref="editorHost" class="sforge-file-network__monaco"
                :class="{'sforge-file-network__monaco--hidden': !editorReady}" />
            <div v-if="loading" class="sforge-file-network__state">
                <svg class="fn__rotate" aria-hidden="true"><use href="#iconRefresh" /></svg>
                <span>正在读取网络文件</span>
            </div>
            <div v-else-if="error" class="sforge-file-network__state sforge-file-network__state--error"
                role="alert">
                <svg aria-hidden="true"><use href="#iconError" /></svg>
                <span>{{ error }}</span>
                <button type="button" class="b3-button b3-button--text" @click="loadDocument">重试</button>
            </div>
        </main>
        <footer class="sforge-file-network__footer">
            <span>{{ statusText }}</span>
            <span v-if="documentData">{{ documentData.size }} bytes · {{ documentData.contentType || "未声明类型" }}</span>
        </footer>
    </section>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref} from "vue";
import {loadFileBrowserMonaco, type FileBrowserMonaco} from "./FileBrowserEditor.monaco";
import {
    readFileBrowserNetworkFile,
    type FileBrowserNetworkDocument,
} from "./FileBrowser.network";
import type {FileBrowserNetworkTabData} from "./FileBrowser.types";
import type {editor as MonacoEditorAPI} from "monaco-editor";

const props = defineProps<{file: FileBrowserNetworkTabData}>();
const editorHost = ref<HTMLDivElement>();
const documentData = ref<FileBrowserNetworkDocument>();
const loading = ref(false);
const error = ref("");
const editorReady = ref(false);
const statusText = computed(() => {
    if (loading.value) {
        return "读取中";
    }
    if (error.value) {
        return "读取失败";
    }
    return documentData.value ? "只读网络文件" : "等待读取";
});

type MonacoEditor = MonacoEditorAPI.IStandaloneCodeEditor;
type MonacoModel = MonacoEditorAPI.ITextModel;
let editor: MonacoEditor | undefined;
let model: MonacoModel | undefined;
let monaco: FileBrowserMonaco | undefined;
let requestRevision = 0;
let disposed = false;
let abortController: AbortController | undefined;

function disposeEditor() {
    editor?.dispose();
    model?.dispose();
    editor = undefined;
    model = undefined;
    editorReady.value = false;
}

async function mountEditor(document: FileBrowserNetworkDocument, revision: number) {
    await nextTick();
    if (disposed || revision !== requestRevision || !editorHost.value) {
        return;
    }
    monaco = await loadFileBrowserMonaco();
    if (disposed || revision !== requestRevision || !editorHost.value) {
        return;
    }
    model = monaco.editor.createModel(document.text, document.language || undefined, monaco.Uri.parse(document.uri));
    editor = monaco.editor.create(editorHost.value, {
        model,
        readOnly: true,
        automaticLayout: true,
        minimap: {enabled: false},
        wordWrap: "on",
        padding: {top: 12, bottom: 12},
        scrollBeyondLastLine: false,
    });
    editorReady.value = true;
}

async function loadDocument() {
    const revision = ++requestRevision;
    abortController?.abort();
    abortController = new AbortController();
    disposeEditor();
    documentData.value = undefined;
    error.value = "";
    loading.value = true;
    try {
        const document = await readFileBrowserNetworkFile({uri: props.file.uri, signal: abortController.signal});
        if (disposed || revision !== requestRevision) {
            return;
        }
        documentData.value = document;
        await mountEditor(document, revision);
    } catch (reason) {
        if (!disposed && revision === requestRevision) {
            error.value = reason instanceof Error ? reason.message : String(reason);
        }
    } finally {
        if (!disposed && revision === requestRevision) {
            loading.value = false;
        }
    }
}

onMounted(() => {
    disposed = false;
    void loadDocument();
});

onBeforeUnmount(() => {
    disposed = true;
    requestRevision += 1;
    abortController?.abort();
    abortController = undefined;
    disposeEditor();
});

defineExpose({loadDocument});
</script>

<style scoped lang="scss" src="./FileBrowserNetworkPanel.scss"></style>
