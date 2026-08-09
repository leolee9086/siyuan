<template>
    <section class="sforge-file-editor" :aria-busy="loading || saving">
        <header class="sforge-file-editor__header">
            <svg class="sforge-file-editor__icon" aria-hidden="true"><use href="#iconCode" /></svg>
            <div class="sforge-file-editor__identity">
                <strong :title="file.name">{{ file.name }}{{ dirty ? " *" : "" }}</strong>
                <span :title="file.path">{{ file.path }}</span>
            </div>
            <span v-if="documentData" class="sforge-file-editor__language">{{ documentData.language }}</span>
            <label v-if="documentData" class="sforge-file-editor__setting">
                <span>换行</span>
                <select v-model="preferences.wordWrap" aria-label="自动换行">
                    <option value="off">关</option>
                    <option value="on">开</option>
                    <option value="wordWrapColumn">列</option>
                    <option value="bounded">边界</option>
                </select>
            </label>
            <label v-if="documentData" class="sforge-file-editor__setting">
                <span>Tab</span>
                <select v-model.number="preferences.tabSize" aria-label="Tab 宽度">
                    <option v-for="size in [2, 4, 8]" :key="size" :value="size">{{ size }}</option>
                </select>
            </label>
            <label v-if="documentData" class="sforge-file-editor__setting">
                <span>字号</span>
                <select v-model.number="preferences.fontSize" aria-label="字体大小">
                    <option v-for="size in [11, 12, 13, 14, 16, 18]" :key="size" :value="size">{{ size }}</option>
                </select>
            </label>
            <label v-if="documentData" class="sforge-file-editor__setting sforge-file-editor__setting--check">
                <input v-model="preferences.minimap" type="checkbox" aria-label="缩略图" />
                <span>缩略图</span>
            </label>
            <label v-if="documentData" class="sforge-file-editor__setting sforge-file-editor__setting--check">
                <input v-model="preferences.autoSave" type="checkbox" aria-label="自动保存" :disabled="documentData.readOnly" />
                <span>自动保存</span>
            </label>
            <label v-if="documentData && preferences.autoSave" class="sforge-file-editor__setting">
                <span>延迟</span>
                <select v-model.number="preferences.autoSaveDelay" aria-label="自动保存延迟">
                    <option :value="500">0.5s</option>
                    <option :value="1000">1s</option>
                    <option :value="2000">2s</option>
                    <option :value="5000">5s</option>
                </select>
            </label>
            <label v-if="documentData" class="sforge-file-editor__setting">
                <span>编码</span>
                <select v-model="selectedEncoding" aria-label="文件编码" :disabled="documentData.readOnly">
                    <option value="utf-8">UTF-8</option>
                    <option value="utf-8-bom">UTF-8 BOM</option>
                    <option value="utf-16le">UTF-16 LE</option>
                    <option value="utf-16be">UTF-16 BE</option>
                </select>
            </label>
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
            <span>{{ statusText }}{{ preferences.autoSave && !documentData?.readOnly ? " · 自动保存" : "" }}</span>
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
import {
    loadFileBrowserEditorPreferences,
    saveFileBrowserEditorPreferences,
} from "./FileBrowserEditor.preferences";
import type {
    FileBrowserEditorDocument,
    FileBrowserEditorEncoding,
    FileBrowserEditorTabData,
} from "./FileBrowser.types";

const props = defineProps<{file: FileBrowserEditorTabData}>();
const editorHost = ref<HTMLDivElement>();
const documentData = ref<FileBrowserEditorDocument>();
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const conflict = ref(false);
const dirty = ref(false);
const editorReady = ref(false);
const preferences = ref(loadFileBrowserEditorPreferences());
const selectedEncoding = ref<FileBrowserEditorEncoding>("utf-8");
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
let originalEncoding: FileBrowserEditorEncoding = "utf-8";
let loadRevision = 0;
let disposed = false;
let changeSubscription: {dispose: () => void} | undefined;
let saveSubscription: {dispose: () => void} | undefined;
let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;

function clearAutoSaveTimer() {
    if (autoSaveTimer !== undefined) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = undefined;
    }
}

function disposeEditor() {
    clearAutoSaveTimer();
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
    dirty.value = Boolean(model && (model.getValue() !== originalText || selectedEncoding.value !== originalEncoding));
    scheduleAutoSave();
}

function applyEditorPreferences() {
    editor?.updateOptions({
        wordWrap: preferences.value.wordWrap,
        tabSize: preferences.value.tabSize,
        minimap: {enabled: preferences.value.minimap},
        fontSize: preferences.value.fontSize,
    });
}

function scheduleAutoSave() {
    clearAutoSaveTimer();
    if (disposed || !preferences.value.autoSave || documentData.value?.readOnly || !dirty.value || saving.value) {
        return;
    }
    const requestRevision = loadRevision;
    autoSaveTimer = setTimeout(() => {
        autoSaveTimer = undefined;
        if (!disposed && requestRevision === loadRevision) {
            void saveDocument();
        }
    }, preferences.value.autoSaveDelay);
}

function toggleWordWrap() {
    preferences.value.wordWrap = preferences.value.wordWrap === "off" ? "on" : "off";
}

async function mountEditor(document: FileBrowserEditorDocument, requestRevision: number) {
    await nextTick();
    if (disposed || requestRevision !== loadRevision || !editorHost.value) {
        return;
    }
    monaco = await loadFileBrowserMonaco();
    if (disposed || requestRevision !== loadRevision || !editorHost.value) {
        return;
    }
    model = monaco.editor.createModel(document.text, document.language, monaco.Uri.parse(editorURI(document)));
    editor = monaco.editor.create(editorHost.value, {
        model,
        readOnly: document.readOnly,
        automaticLayout: true,
        minimap: {enabled: false},
        wordWrap: preferences.value.wordWrap,
        tabSize: preferences.value.tabSize,
        fontSize: preferences.value.fontSize,
        padding: {top: 12, bottom: 12},
        scrollBeyondLastLine: false,
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
    editor.addAction({
        id: "sforge.file-browser.toggle-word-wrap",
        label: "切换自动换行",
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
        contextMenuGroupId: "2_view",
        run: () => toggleWordWrap(),
    });
    editorReady.value = true;
    applyEditorPreferences();
}

async function loadDocument() {
    const requestRevision = ++loadRevision;
    disposeEditor();
    loading.value = true;
    error.value = "";
    conflict.value = false;
    dirty.value = false;
    documentData.value = undefined;
    selectedEncoding.value = "utf-8";
    originalEncoding = "utf-8";
    try {
        const document = await fileBrowserRepository.readEditorFile({rootID: props.file.rootID, path: props.file.path});
        if (disposed || requestRevision !== loadRevision) {
            return;
        }
        documentData.value = document;
        originalText = document.text;
        selectedEncoding.value = document.encoding;
        originalEncoding = document.encoding;
        await mountEditor(document, requestRevision);
    } catch (reason) {
        if (!disposed && requestRevision === loadRevision) {
            error.value = reason instanceof Error ? reason.message : String(reason);
        }
    } finally {
        if (!disposed && requestRevision === loadRevision) {
            loading.value = false;
        }
    }
}

async function saveDocument() {
    if (!documentData.value || documentData.value.readOnly || !model || saving.value || !dirty.value) {
        return;
    }
    clearAutoSaveTimer();
    saving.value = true;
    error.value = "";
    const textAtStart = model.getValue();
    const encodingAtStart = selectedEncoding.value;
    const saveRevision = loadRevision;
    let saveSucceeded = false;
    try {
        const saved = await fileBrowserRepository.writeEditorFile({
            rootID: documentData.value.root.id,
            path: documentData.value.entry.path,
            text: textAtStart,
            encoding: encodingAtStart,
            revision: documentData.value.revision,
        });
        if (disposed || saveRevision !== loadRevision) {
            return;
        }
        documentData.value = {...documentData.value, ...saved};
        originalText = textAtStart;
        originalEncoding = encodingAtStart;
        updateDirtyState();
        conflict.value = false;
        saveSucceeded = true;
    } catch (reason) {
        if (disposed || saveRevision !== loadRevision) {
            return;
        }
        const message = reason instanceof Error ? reason.message : String(reason);
        if (/changed externally|external|冲突|修改/i.test(message)) {
            conflict.value = true;
        } else {
            error.value = message;
        }
    } finally {
        saving.value = false;
        // updateDirtyState runs while saving is true and therefore deliberately
        // does not schedule a timer. Re-arm only after a successful write when
        // a local edit arrived while the request was in flight; failures and
        // conflicts stay visible for an explicit retry instead of looping.
        if (saveSucceeded && dirty.value) {
            scheduleAutoSave();
        }
    }
}

watch(preferences, value => {
    saveFileBrowserEditorPreferences(value);
    applyEditorPreferences();
    scheduleAutoSave();
}, {deep: true});
watch(selectedEncoding, () => updateDirtyState());
watch(() => `${props.file.rootID}\n${props.file.path}`, () => void loadDocument());
onMounted(() => {
    disposed = false;
    void loadDocument();
});
onBeforeUnmount(() => {
    clearAutoSaveTimer();
    disposed = true;
    loadRevision += 1;
    disposeEditor();
});

defineExpose({loadDocument, saveDocument});
</script>

<style scoped lang="scss" src="./FileBrowserEditorPanel.scss"></style>
