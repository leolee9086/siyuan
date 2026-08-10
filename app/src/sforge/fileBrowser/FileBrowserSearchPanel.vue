<template>
    <section ref="searchRoot" class="sforge-file-search" aria-label="文件标签和颜色检索">
        <form class="sforge-file-search__form" @submit.prevent="submit">
            <div class="sforge-file-search__primary">
                <label class="sforge-file-search__query">
                    <svg aria-hidden="true"><use href="#iconSearch" /></svg>
                    <input v-model="keyword" class="b3-text-field" type="search"
                        placeholder="名称、路径、注释或标签" aria-label="关键词" @input="scheduleSubmit" />
                </label>
                <button type="submit" class="block__icon ariaLabel sforge-file-search__submit" aria-label="执行文件查询"
                    :disabled="loading">
                    <svg :class="{'fn__rotate': loading}"><use :href="loading ? '#iconRefresh' : '#iconSearch'" /></svg>
                </button>
                <button v-if="hasQuery" type="button" class="block__icon ariaLabel" aria-label="清空文件查询"
                    @click="clear">
                    <svg><use href="#iconClose" /></svg>
                </button>
            </div>

            <div class="sforge-file-search__scope-line">
                <label class="sforge-file-search__check">
                    <input v-model="allRoots" type="checkbox" @change="scheduleSubmit" />
                    <span>全部文件根</span>
                </label>
                <select v-model="selectedRootIDs" class="b3-select sforge-file-search__roots" multiple
                    :disabled="allRoots" aria-label="文件根范围" @change="scheduleSubmit">
                    <option v-for="root in roots" :key="root.id" :value="root.id">
                        {{ root.label }}{{ root.exists ? "" : "（失效）" }}
                    </option>
                </select>
                <FileBrowserMultiSelect v-model="selectedExtensions" :options="extensions" placeholder="扩展名"
                    ariaLabel="扩展名筛选" @update:model-value="scheduleExtensionSubmit" />
                <input ref="tagsInput" v-model="tagsText" class="b3-text-field" type="text" placeholder="标签，以逗号分隔"
                    aria-label="标签筛选" @input="scheduleSubmit" />
                <label class="sforge-file-search__check">
                    <input v-model="matchAllTags" type="checkbox" @change="scheduleSubmit" />
                    <span>全部标签</span>
                </label>
            </div>

            <div class="sforge-file-search__facet-line" aria-label="快速筛选">
                <button type="button" class="sforge-file-search__facet" :class="{'is-active': colorEnabled}"
                    aria-label="颜色筛选" :aria-expanded="colorEnabled" @click="toggleColorFilter">
                    <span class="sforge-file-search__facet-rainbow" aria-hidden="true">
                        <span class="sforge-file-search__facet-swatch" :style="{backgroundColor: color}" />
                    </span>
                    <span>颜色</span>
                </button>
                <button type="button" class="sforge-file-search__facet" :class="{'is-active': Boolean(tagsText.trim())}"
                    aria-label="标签筛选入口" @click="focusTags">标签</button>
                <button type="button" class="sforge-file-search__facet"
                    :class="{'is-active': selectedExtensions.length > 0}" aria-label="扩展名筛选入口"
                    @click="focusExtensions">格式</button>
                <span class="sforge-file-search__facet-spacer" />
                <select v-model="orderBy" class="b3-select sforge-file-search__sort" aria-label="查询排序"
                    @change="scheduleSubmit">
                    <option value="updated">最近更新</option>
                    <option value="name">名称</option>
                    <option value="size">大小</option>
                    <option value="resolution">分辨率</option>
                    <option value="star">星级</option>
                </select>
            </div>

            <div v-if="colorEnabled" class="sforge-file-search__color-line is-active" aria-label="颜色检索条件">
                <label class="sforge-file-search__check">
                    <input v-model="colorEnabled" type="checkbox" aria-label="启用颜色检索" @change="scheduleSubmit" />
                    <span>颜色条件</span>
                </label>
                <span class="sforge-file-search__color-picker" :class="{'is-disabled': !colorEnabled}">
                    <input ref="colorInput" v-model="color" type="color" aria-label="RGB 目标颜色"
                        :disabled="!colorEnabled" @input="scheduleSubmit" />
                </span>
                <label class="sforge-file-search__number">
                    <span>容差</span>
                    <input v-model="tolerance" type="number" min="0" max="442" step="1" aria-label="颜色容差"
                        :disabled="!colorEnabled" @input="scheduleSubmit" />
                </label>
                <label class="sforge-file-search__number">
                    <span>比例</span>
                    <input v-model="minRatio" type="number" min="0" max="1" step="0.05" aria-label="最小调色板比例"
                        :disabled="!colorEnabled" @input="scheduleSubmit" />
                </label>
                <label class="sforge-file-search__number">
                    <span>H</span>
                    <input v-model="minH" type="number" min="0" max="360" step="1" aria-label="最小色相"
                        :disabled="!colorEnabled" @input="scheduleSubmit" />
                    <input v-model="maxH" type="number" min="0" max="360" step="1" aria-label="最大色相"
                        :disabled="!colorEnabled" @input="scheduleSubmit" />
                </label>
                <label class="sforge-file-search__number">
                    <span>S</span>
                    <input v-model="minS" type="number" min="0" max="100" step="1" aria-label="最小饱和度"
                        :disabled="!colorEnabled" @input="scheduleSubmit" />
                    <input v-model="maxS" type="number" min="0" max="100" step="1" aria-label="最大饱和度"
                        :disabled="!colorEnabled" @input="scheduleSubmit" />
                </label>
                <label class="sforge-file-search__number">
                    <span>L</span>
                    <input v-model="minL" type="number" min="0" max="100" step="1" aria-label="最小亮度"
                        :disabled="!colorEnabled" @input="scheduleSubmit" />
                    <input v-model="maxL" type="number" min="0" max="100" step="1" aria-label="最大亮度"
                        :disabled="!colorEnabled" @input="scheduleSubmit" />
                </label>
            </div>
        </form>

        <div v-if="error" class="sforge-file-search__state sforge-file-search__state--error">{{ error }}</div>
    </section>
</template>

<script setup lang="ts">
/** 用途：查询表单、结果投影和根标签显示；使用范围：文件 Dock 搜索区域。 */
import {computed, nextTick, onBeforeUnmount, ref, watch} from "vue";
import {FILE_BROWSER_GALLERY_DEFAULT_EXTENSIONS} from "./FileBrowser.gallery.constants";
import FileBrowserMultiSelect from "./FileBrowserMultiSelect.vue";
import type {FileBrowserRoot} from "./FileBrowser.types";
import type {
    FileBrowserPaletteSearch,
    FileBrowserSearchRequest,
} from "./FileBrowser.query.types";

const props = defineProps<{
    roots: FileBrowserRoot[];
    loading: boolean;
    error: string;
    scope?: {rootID: string; path: string} | undefined;
    availableExtensions?: readonly string[];
    initialRequest?: FileBrowserSearchRequest | undefined;
}>();

const tagsInput = ref<HTMLInputElement>();
const colorInput = ref<HTMLInputElement>();
const searchRoot = ref<HTMLElement>();

const emit = defineEmits<{
    search: [request: FileBrowserSearchRequest];
    clear: [];
}>();

function cleanStringList(values: readonly string[] | undefined) {
    return (values ?? []).map(value => value.trim()).filter(Boolean);
}

const initialRequest = props.initialRequest ?? {};
const initialAllRoots = computed(() => Boolean(props.initialRequest?.allRoots));
const keyword = ref(initialRequest.keyword ?? "");
const allRoots = ref(initialRequest.allRoots ?? false);
const selectedRootIDs = ref<string[]>(initialRequest.rootIDs ? cleanStringList(initialRequest.rootIDs) :
    (props.scope ? [props.scope.rootID] : []));
const tagsText = ref(cleanStringList(initialRequest.tags).join(", "));
const selectedExtensions = ref<string[]>(cleanStringList(initialRequest.exts));
const matchAllTags = ref(initialRequest.matchAllTags ?? false);
const colorEnabled = ref(false);
const color = ref("#ffffff");
const tolerance = ref("30");
const minRatio = ref("");
const minH = ref("");
const maxH = ref("");
const minS = ref("");
const maxS = ref("");
const minL = ref("");
const maxL = ref("");
const orderBy = ref<NonNullable<FileBrowserSearchRequest["orderBy"]>>(initialRequest.orderBy ?? "updated");
let submitTimer: ReturnType<typeof setTimeout> | undefined;

function colorToHex(value: [number, number, number] | undefined) {
    if (!value) {
        return "#ffffff";
    }
    return `#${value.map(channel => Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16).padStart(2, "0")).join("")}`;
}

/** 从当前页签初始查询恢复表单；目录范围变化时必须清除上一目录的本地筛选。 */
function resetFormFromProps() {
    const request = props.initialRequest ?? {};
    keyword.value = request.keyword ?? "";
    allRoots.value = request.allRoots ?? false;
    selectedRootIDs.value = request.rootIDs ? cleanStringList(request.rootIDs) :
        (props.scope ? [props.scope.rootID] : []);
    tagsText.value = cleanStringList(request.tags).join(", ");
    selectedExtensions.value = cleanStringList(request.exts);
    matchAllTags.value = request.matchAllTags ?? false;
    colorEnabled.value = Boolean(request.palette);
    color.value = colorToHex(request.palette?.color);
    tolerance.value = request.palette?.tolerance === undefined ? "30" : String(request.palette.tolerance);
    minRatio.value = request.palette?.minRatio === undefined ? "" : String(request.palette.minRatio);
    minH.value = request.palette?.minH === undefined ? "" : String(request.palette.minH);
    maxH.value = request.palette?.maxH === undefined ? "" : String(request.palette.maxH);
    minS.value = request.palette?.minS === undefined ? "" : String(request.palette.minS);
    maxS.value = request.palette?.maxS === undefined ? "" : String(request.palette.maxS);
    minL.value = request.palette?.minL === undefined ? "" : String(request.palette.minL);
    maxL.value = request.palette?.maxL === undefined ? "" : String(request.palette.maxL);
    orderBy.value = request.orderBy ?? "updated";
}

watch(
    [() => props.scope?.rootID, () => props.scope?.path, () => props.initialRequest],
    resetFormFromProps,
    {deep: true},
);

const extensions = computed(() => {
    const values = new Set<string>(FILE_BROWSER_GALLERY_DEFAULT_EXTENSIONS);
    for (const extension of props.availableExtensions ?? []) {
        const normalized = extension.trim().toLowerCase();
        if (normalized) {
            values.add(normalized.startsWith(".") ? normalized : `.${normalized}`);
        }
    }
    // 保留当前查询中的扩展名，即使结果为空或索引暂时没有返回该类型，
    // 用户仍然可以在下拉菜单中直接取消这个条件。
    for (const extension of selectedExtensions.value) {
        const normalized = extension.trim().toLowerCase();
        if (normalized) {
            values.add(normalized.startsWith(".") ? normalized : `.${normalized}`);
        }
    }
    return [...values].sort((left, right) => left.localeCompare(right));
});

const hasQuery = computed(() => Boolean(keyword.value.trim() || tagsText.value.trim() ||
    selectedExtensions.value.length > 0 || colorEnabled.value || minRatio.value || minH.value || maxH.value ||
    minS.value || maxS.value || minL.value || maxL.value));

function numberValue(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function parseColor(value: string): [number, number, number] | undefined {
    const normalized = value.trim().replace(/^#/, "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
        return undefined;
    }
    return [
        Number.parseInt(normalized.slice(0, 2), 16),
        Number.parseInt(normalized.slice(2, 4), 16),
        Number.parseInt(normalized.slice(4, 6), 16),
    ];
}

function buildPalette(): FileBrowserPaletteSearch | undefined {
    const target = parseColor(color.value);
    if (!colorEnabled.value || !target) {
        return undefined;
    }
    const palette: FileBrowserPaletteSearch = {color: target};
    const toleranceValue = numberValue(tolerance.value);
    const ratioValue = numberValue(minRatio.value);
    const minimumHue = numberValue(minH.value);
    const maximumHue = numberValue(maxH.value);
    const minimumSaturation = numberValue(minS.value);
    const maximumSaturation = numberValue(maxS.value);
    const minimumLightness = numberValue(minL.value);
    const maximumLightness = numberValue(maxL.value);
    if (toleranceValue !== undefined) {
        palette.tolerance = toleranceValue;
    }
    if (ratioValue !== undefined) {
        palette.minRatio = ratioValue;
    }
    if (minimumHue !== undefined) {
        palette.minH = minimumHue;
    }
    if (maximumHue !== undefined) {
        palette.maxH = maximumHue;
    }
    if (minimumSaturation !== undefined) {
        palette.minS = minimumSaturation;
    }
    if (maximumSaturation !== undefined) {
        palette.maxS = maximumSaturation;
    }
    if (minimumLightness !== undefined) {
        palette.minL = minimumLightness;
    }
    if (maximumLightness !== undefined) {
        palette.maxL = maximumLightness;
    }
    return palette;
}

function focusTags() {
    tagsInput.value?.focus();
}

function focusExtensions() {
    const trigger = searchRoot.value?.querySelector<HTMLButtonElement>("button[aria-label='扩展名筛选']");
    trigger?.focus();
    trigger?.click();
}

function toggleColorFilter() {
    colorEnabled.value = !colorEnabled.value;
    scheduleSubmit();
    if (colorEnabled.value) {
        void nextTick(() => colorInput.value?.focus());
    }
}

/**
 * 参考画廊在筛选控件变化后刷新结果；防抖保留连续勾选多个条件时的单次查询语义。
 * 手动提交和清空会取消尚未发出的刷新，避免旧表单在新范围上再次执行。
 */
function cancelScheduledSubmit() {
    if (submitTimer !== undefined) {
        clearTimeout(submitTimer);
        submitTimer = undefined;
    }
}

function scheduleSubmit() {
    cancelScheduledSubmit();
    submitTimer = setTimeout(() => {
        submitTimer = undefined;
        submit();
    }, 300);
}

function scheduleExtensionSubmit() {
    scheduleSubmit();
}

function submit() {
    cancelScheduledSubmit();
    const tags = tagsText.value.split(",").map(tag => tag.trim()).filter(Boolean);
    const palette = buildPalette();
    const request: FileBrowserSearchRequest = {orderBy: orderBy.value};
    const queryKeyword = keyword.value.trim();
    if (queryKeyword) {
        request.keyword = queryKeyword;
    }
    if (allRoots.value) {
        request.allRoots = true;
    } else if (selectedRootIDs.value.length > 0) {
        request.rootIDs = [...selectedRootIDs.value];
    }
    if (!allRoots.value && props.scope?.path) {
        request.pathPrefix = props.scope.path;
    }
    if (tags.length > 0) {
        request.tags = tags;
        request.matchAllTags = matchAllTags.value;
    }
    if (selectedExtensions.value.length > 0) {
        request.exts = [...selectedExtensions.value];
    }
    if (palette) {
        request.palette = palette;
    }
    emit("search", request);
}

function clear() {
    cancelScheduledSubmit();
    keyword.value = "";
    allRoots.value = initialAllRoots.value;
    selectedRootIDs.value = [];
    tagsText.value = "";
    selectedExtensions.value = [];
    matchAllTags.value = false;
    colorEnabled.value = false;
    color.value = "#ffffff";
    tolerance.value = "30";
    minRatio.value = "";
    minH.value = "";
    maxH.value = "";
    minS.value = "";
    maxS.value = "";
    minL.value = "";
    maxL.value = "";
    emit("clear");
}

onBeforeUnmount(cancelScheduledSubmit);
</script>

<style scoped lang="scss">
.sforge-file-search {
    flex: none;
    min-width: 0;
    border-bottom: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
}

.sforge-file-search__form {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 6px 10px 7px;
}

.sforge-file-search__primary,
.sforge-file-search__scope-line,
.sforge-file-search__facet-line,
.sforge-file-search__color-line {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 6px;
}

.sforge-file-search__primary {
    min-height: 32px;
}

.sforge-file-search__query {
    display: flex;
    flex: 1 1 280px;
    min-width: 120px;
    align-items: center;
    gap: 5px;
    padding: 0 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius);
    background: var(--b3-theme-surface);
}

.sforge-file-search__query:focus-within {
    border-color: var(--b3-theme-primary-light);
    box-shadow: 0 0 0 1px var(--b3-theme-primary-lighter);
}

.sforge-file-search__query svg {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--b3-theme-on-surface);
    fill: currentcolor;
}

.sforge-file-search__query .b3-text-field {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 3px 0;
    border: 0;
    background: transparent;
    box-shadow: none;
}

.sforge-file-search__query .b3-text-field:focus {
    box-shadow: none;
}

.sforge-file-search__submit {
    color: var(--b3-theme-primary);
}

.sforge-file-search__scope-line {
    flex-wrap: wrap;
}

.sforge-file-search__scope-line > .sforge-multi-select {
    flex: 1 1 118px;
}

.sforge-file-search__scope-line > .b3-text-field {
    flex: 1 1 160px;
    min-width: 120px;
    height: 28px;
}

.sforge-file-search__roots {
    flex: 1 1 150px;
    min-width: 110px;
    height: 28px;
}

.sforge-file-search__facet-line {
    min-height: 30px;
    padding-top: 4px;
    border-top: 1px solid color-mix(in srgb, var(--b3-border-color) 65%, transparent);
}

.sforge-file-search__facet {
    display: inline-flex;
    min-height: 26px;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--b3-theme-on-surface);
    background: transparent;
    cursor: pointer;
    font-size: 11px;
}

.sforge-file-search__facet:hover,
.sforge-file-search__facet:focus-visible,
.sforge-file-search__facet.is-active {
    border-color: var(--b3-theme-primary-light);
    color: var(--b3-theme-primary);
    background: var(--b3-theme-secondary);
    outline: none;
}

.sforge-file-search__facet-rainbow {
    display: inline-flex;
    width: 17px;
    height: 17px;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 50%;
    background: conic-gradient(#ff3b30, #ffcc00, #34c759, #00c7be, #007aff, #af52de, #ff2d55, #ff3b30);
    box-sizing: border-box;
}

.sforge-file-search__facet-swatch {
    width: 100%;
    height: 100%;
    border: 1px solid var(--b3-theme-background);
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--b3-border-color) 70%, transparent);
}

.sforge-file-search__facet-spacer {
    flex: 1;
}

.sforge-file-search__sort {
    flex: 0 0 112px;
    min-width: 96px;
    height: 28px;
}

.sforge-file-search__color-line {
    flex-wrap: wrap;
    min-height: 30px;
    padding-top: 4px;
    border-top: 1px solid color-mix(in srgb, var(--b3-border-color) 65%, transparent);
}

.sforge-file-search__color-picker {
    display: inline-flex;
    width: 30px;
    height: 30px;
    flex: none;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 50%;
    background: conic-gradient(from -28deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00c7be,
        #007aff, #5856d6, #af52de, #ff2d55, #ff3b30);
    box-sizing: border-box;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--b3-border-color) 75%, transparent);
}

.sforge-file-search__color-picker input[type="color"] {
    width: 100%;
    height: 100%;
    padding: 2px;
    border: 2px solid var(--b3-theme-background);
    border-radius: 50%;
    background: transparent;
    box-sizing: border-box;
    cursor: pointer;
}

.sforge-file-search__color-picker input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
}

.sforge-file-search__color-picker input[type="color"]::-webkit-color-swatch {
    border: 0;
    border-radius: 50%;
}

.sforge-file-search__color-picker.is-disabled {
    opacity: .62;
}

.sforge-file-search__color-picker input[type="color"]:disabled {
    cursor: not-allowed;
}

.sforge-file-search__check {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    color: var(--b3-theme-on-surface);
    font-size: 11px;
    white-space: nowrap;
}

.sforge-file-search__number {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--b3-theme-on-surface);
    font-size: 10px;
    white-space: nowrap;
}

.sforge-file-search__number input {
    width: 46px;
    height: 26px;
    padding: 2px 4px;
}

.sforge-file-search__state,
.sforge-file-search__footer {
    padding: 5px 10px;
    color: var(--b3-theme-on-surface);
    font-size: 11px;
}

.sforge-file-search__state--error {
    color: var(--b3-theme-error);
    overflow-wrap: anywhere;
}

@container file-gallery (max-width: 720px) {
    .sforge-file-search__scope-line > .b3-text-field {
        flex-basis: 140px;
    }

    .sforge-file-search__color-line {
        align-items: flex-start;
    }
}

@container file-gallery (max-width: 520px) {
    .sforge-file-search__primary {
        flex-wrap: wrap;
    }

    .sforge-file-search__query {
        flex-basis: calc(100% - 72px);
    }

    .sforge-file-search__scope-line > .sforge-multi-select,
    .sforge-file-search__scope-line > .b3-text-field,
    .sforge-file-search__roots {
        flex-basis: calc(50% - 3px);
    }

    .sforge-file-search__sort {
        flex-basis: 108px;
    }
}
</style>
