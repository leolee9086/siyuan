<template>
    <div ref="container" class="sforge-multi-select" :class="{'sforge-multi-select--open': open}">
        <button type="button" class="sforge-multi-select__trigger" :aria-label="ariaLabel"
            :aria-expanded="open" :disabled="disabled" @click.stop="toggleOpen">
            <span class="sforge-multi-select__value" :class="{'sforge-multi-select__value--placeholder': selected.length === 0}">
                {{ selected.length === 0 ? placeholder : selectedLabels.join(", ") }}
            </span>
            <svg aria-hidden="true"><use :href="open ? '#iconUp' : '#iconDown'" /></svg>
        </button>

        <div v-if="open" class="sforge-multi-select__menu" role="listbox" aria-multiselectable="true"
            :aria-label="ariaLabel" @click.stop>
            <input v-model="searchText" class="b3-text-field sforge-multi-select__search" type="search"
                :placeholder="`搜索${placeholder}`" :aria-label="`搜索${placeholder}`" @keydown.esc="close" />
            <label class="sforge-multi-select__select-all">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
                <span>全选</span>
            </label>
            <div class="sforge-multi-select__options">
                <label v-for="option in filteredOptions" :key="option" class="sforge-multi-select__option"
                    role="option" :aria-selected="selected.includes(option)">
                    <input type="checkbox" :value="option" :checked="selected.includes(option)" @change="toggle(option)" />
                    <span>{{ optionLabels?.[option] ?? option }}</span>
                </label>
                <span v-if="filteredOptions.length === 0" class="sforge-multi-select__empty">没有匹配项</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from "vue";

const props = withDefaults(defineProps<{
    options: readonly string[];
    modelValue: readonly string[];
    placeholder: string;
    ariaLabel: string;
    optionLabels?: Readonly<Record<string, string>>;
    disabled?: boolean;
}>(), {
    optionLabels: undefined,
    disabled: false,
});

const emit = defineEmits<{
    "update:modelValue": [value: string[]];
}>();

const container = ref<HTMLElement>();
const open = ref(false);
const searchText = ref("");
const selected = computed(() => [...props.modelValue]);
const selectedLabels = computed(() => selected.value.map(option => props.optionLabels?.[option] ?? option));
const filteredOptions = computed(() => {
    const query = searchText.value.trim().toLowerCase();
    return query ? props.options.filter(option => option.toLowerCase().includes(query)) : [...props.options];
});
const allSelected = computed(() => props.options.length > 0 && props.options.every(option => selected.value.includes(option)));

function toggleOpen() {
    if (props.disabled) {
        return;
    }
    open.value = !open.value;
    if (open.value) {
        return;
    }
    searchText.value = "";
}

function close() {
    open.value = false;
    searchText.value = "";
}

function toggle(option: string) {
    const next = selected.value.includes(option) ? selected.value.filter(item => item !== option) :
        [...selected.value, option];
    emit("update:modelValue", props.options.filter(item => next.includes(item)));
}

function toggleAll() {
    emit("update:modelValue", allSelected.value ? [] : [...props.options]);
}

function handleOutsideClick(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Node)) {
        return;
    }
    if (open.value && container.value && !container.value.contains(target)) {
        close();
    }
}

onMounted(() => document.addEventListener("click", handleOutsideClick, true));
onBeforeUnmount(() => document.removeEventListener("click", handleOutsideClick, true));
</script>

<style scoped lang="scss">
.sforge-multi-select {
    position: relative;
    flex: 1 1 110px;
    min-width: 100px;
}

.sforge-multi-select__trigger {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    height: 28px;
    padding: 4px 8px;
    border: 0;
    border-radius: var(--b3-border-radius);
    box-shadow: inset 0 0 0 1px var(--b3-border-color);
    color: var(--b3-theme-on-background);
    background: var(--b3-select-background);
    cursor: pointer;
    text-align: left;
}

.sforge-multi-select__trigger:hover,
.sforge-multi-select__trigger:focus-visible {
    box-shadow: inset 0 0 0 1px var(--b3-theme-primary-light), 0 0 0 .6px var(--b3-theme-primary-lighter);
    outline: none;
}

.sforge-multi-select__trigger:disabled {
    opacity: .68;
    cursor: not-allowed;
}

.sforge-multi-select__value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sforge-multi-select__value--placeholder {
    color: var(--b3-theme-on-surface);
}

.sforge-multi-select__trigger > svg {
    flex: none;
    width: 14px;
    height: 14px;
    margin-left: 4px;
}

.sforge-multi-select__menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    left: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    max-height: 300px;
    padding: 6px;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius-b);
    box-shadow: var(--b3-dialog-shadow);
    background: var(--b3-menu-background);
}

.sforge-multi-select__search {
    flex: none;
    width: 100%;
    height: 28px;
    margin-bottom: 5px;
}

.sforge-multi-select__select-all,
.sforge-multi-select__option {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 28px;
    padding: 2px 5px;
    color: var(--b3-theme-on-background);
    cursor: pointer;
    font-size: 12px;
}

.sforge-multi-select__select-all {
    border-bottom: 1px solid var(--b3-border-color);
    margin-bottom: 4px;
}

.sforge-multi-select__option:hover,
.sforge-multi-select__select-all:hover {
    background: var(--b3-list-hover);
}

.sforge-multi-select__options {
    min-height: 0;
    overflow: auto;
}

.sforge-multi-select__empty {
    display: block;
    padding: 8px 5px;
    color: var(--b3-theme-on-surface);
    font-size: 12px;
}
</style>
