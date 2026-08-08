<template>
    <section class="sforge-file-editor" :aria-busy="loading || saving">
        <header class="sforge-file-editor__header">
            <svg class="sforge-file-editor__icon" aria-hidden="true"><use href="#iconCode" /></svg>
            <div class="sforge-file-editor__identity">
                <strong :title="file.name">{{ file.name }}{{ dirty ? " *" : "" }}</strong>
                <span :title="file.path">{{ file.path }}</span>
            </div>
            <span v-if="documentData" class="sforge-file-editor__language">{{ documentData.language }}</span>
            <span v-if="documentData" class="sforge-file-editor__encoding">{{ documentData.encoding }}</span>
            <button v-if="documentData && !documentData.readOnly" type="button"
                class="block__icon ariaLabel" aria-label="保存文件" :disabled="saving || loading || !dirty"
                @click="saveDocument">
                <svg aria-hidden="true"><use href="#iconSave" /></svg>
            </button>
        </header>
        <div class="sforge-file-editor__content">
            <div ref="editorHost" class="sforge-file-editor__monaco" :class="{'sforge-file-editor__monaco--hidden': !editorReady}" />
            <div v-if="loading" class="sforge-file-editor__state">
                <svg class="fn__rotate" aria-hidden="true"><use href="#iconRefresh" /></svg>
                <span>正在读取文件</span>
            </div>
            <div v-else-if="error" class="sforge-file-editor__state sforge-file-editor__state--error">
                <svg aria-hidden="true"><use href="#iconError" /></svg>
                <span>{{ error }}</span>
                <button type="button" class="b3-button b3-button--text" @click="loadDocument">重试</button>
            </div>
            <div v-else-if="conflict" class="sforge-file-editor__state sforge-file-editor__state--error">
                <svg aria-hidden="true"><use href="#iconWarning" /></svg>
                <span>文件已被外部修改，当前编辑内容仍保留</span>
                <div class="sforge-file-editor__state-actions">
                    <button type="button" class="b3-button b3-button--text" @click="loadDocument">重新读取</button>
                    <button type="button" class="b3-button b3-button--text" @click="conflict = false">继续编辑</button>
                </div>
            </div>
            <div v-else-if="documentData && documentData.readOnly" class="sforge-file-editor__readonly">
                <svg aria-hidden="true"><use href="#iconLock" /></svg>
                <span>只读文件</span>
            </div>
        </div>
        <footer class="sforge-file-editor__footer">
            <span>{{ statusText }}</span>
            <span v-if="documentData">{{ documentData.size }} bytes · revision {{ documentData.revision.slice(0, 12) }}</span>
        </footer>
    </section>
</template>

<script setup lang="ts">
/** 用途：Vue 响应式状态；使用范围：编辑器页签生命周期与保存反馈。 */
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from "vue";
/** 用途：本地文件编辑仓储；使用范围：有界读取与 revision 保存。 */
import {fileBrowserRepository} from "./FileBrowser.repository";
/** 用途：延迟加载官方 Monaco 和 worker；使用范围：编辑器宿主初始化。 */
import {loadFileBrowserMonaco, type FileBrowserMonaco} from "./FileBrowserEditor.monaco";
/** 用途：编辑页签入口数据；使用范围：组件边界。 */
import type {FileBrowserEditorDocument, FileBrowserEditorTabData} from "./FileBrowser.types";

const props = defineProps<{file: FileBrowserEditorTabData}>();
const editorHost = ref<HTMLDivElement>();
const documentData = ref<FileBrowserEditorDocument>();
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const conflict = ref(false);
const dirty = ref(false);
const editorReady = ref(false);
const statusText = computed(() => {
    if (loading.value) {
        return "读取中";
    }
    if (saving.value) {
        return "保存中";
    }
    if (error.value) {
        return "读取失败";
    }
    if (conflict.value) {
        return "存在外部修改";
    }
    if (dirty.value) {
        return "有未保存修改";
    }
    return documentData.value?.readOnly ? "只读" : "已保存";
});

type MonacoEditor = FileBrowserMonaco["editor"]["IStandaloneCodeEditor"];
type MonacoModel = FileBrowserMonaco["editor"]["ITextModel"];
let monaco: FileBrowserMonaco | undefined;
let editor: MonacoEditor | undefined;
let model: MonacoModel | undefined;
let originalText = "";
let loadRevision = 0;
let changeSubscription: {dispose: () => void} | undefined;
let saveSubscription: {dispose: () => void} | undefined;

function disposeEditor() {
    changeSubscription?.dispose();
    saveSubscription?.dispose();
    changeSubscription = undefined;
    saveSubscription = undefined;
    editor?.dispose();
    model?.dispose();
    editor = undefined;
    model = undefined;
    editorReady.value = false;
}

function editorURI(document: FileBrowserEditorDocument) {
    const path = document.entry.path.split("/").map(encodeURIComponent).join("/");
    return `sforge://${encodeURIComponent(document.root.id)}/${path}`;
}

function updateDirtyState() {
    dirty.value = Boolean(model && model.getValue() !== originalText);
}

async function mountEditor(document: FileBrowserEditorDocument, requestRevision: number) {
    await nextTick();
    if (requestRevision !== loadRevision || !editorHost.value) {
        return;
    }
    monaco = await loadFileBrowserMonaco();
    if (requestRevision !== loadRevision || !editorHost.value) {
        return;
    }
    model = monaco.editor.createModel(document.text, document.language, monaco.Uri.parse(editorURI(document)));
    editor = monaco.editor.create(editorHost.value, {
        model,
        readOnly: document.readOnly,
        automaticLayout: true,
        minimap: {enabled: false},
        wordWrap: "on",
        padding: {top: 12, bottom: 12},
        scrollBeyondLastLine: false,
        fontSize: 13,
    });
    changeSubscription = model.onDidChangeContent(() => updateDirtyState());
    if (!document.readOnly) {
        saveSubscription = editor.addAction({
            id: "sforge.file-browser.save",
            label: "保存文件",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            run: () => saveDocument(),
        });
    }
    editorReady.value = true;
}

async function loadDocument() {
    const requestRevision = ++loadRevision;
    disposeEditor();
    loading.value = true;
    error.value = "";
    conflict.value = false;
    dirty.value = false;
    documentData.value = undefined;
    try {
        const document = await fileBrowserRepository.readEditorFile({rootID: props.file.rootID, path: props.file.path});
        if (requestRevision !== loadRevision) {
            return;
        }
        documentData.value = document;
        originalText = document.text;
        await mountEditor(document, requestRevision);
    } catch (reason) {
        if (requestRevision === loadRevision) {
            error.value = reason instanceof Error ? reason.message : String(reason);
        }
    } finally {
        if (requestRevision === loadRevision) {
            loading.value = false;
        }
    }
}

async function saveDocument() {
    if (!documentData.value || documentData.value.readOnly || !model || saving.value || !dirty.value) {
        return;
    }
    saving.value = true;
    error.value = "";
    try {
        const saved = await fileBrowserRepository.writeEditorFile({
            rootID: documentData.value.root.id,
            path: documentData.value.entry.path,
            text: model.getValue(),
            encoding: documentData.value.encoding,
            revision: documentData.value.revision,
        });
        documentData.value = {...documentData.value, ...saved};
        originalText = model.getValue();
        dirty.value = false;
        conflict.value = false;
    } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        if (/changed externally|external|冲突|修改/i.test(message)) {
            conflict.value = true;
        } else {
            error.value = message;
        }
    } finally {
        saving.value = false;
    }
}

watch(() => `${props.file.rootID}\n${props.file.path}`, () => void loadDocument());
onMounted(() => void loadDocument());
onBeforeUnmount(disposeEditor);

defineExpose({loadDocument, saveDocument});
</script>

<style scoped lang="scss" src="./FileBrowserEditorPanel.scss"></style>
