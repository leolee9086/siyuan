<template>
    <div class="b3-label config__item">
        {{ label }}
        <div class="b3-label__text" v-html="description"></div>
        <span class="fn__hr"></span>
        <div class="fn__flex">
            <select style="min-width: 200px" class="b3-select" :id="selectId" v-model="selectValue"
                @change="handleChange">
                <option value="">{{ placeholderText }}</option>
                <option v-for="option in options" :key="option.value" :value="option.value">
                    {{ option.label }}
                </option>
            </select>
            <div class="fn__space"></div>
            <input class="b3-text-field fn__flex-1" :id="inputId" v-model="inputValue" @change="handleChange" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Option {
    value: string
    label: string
}

interface Props {
    selectId: string
    inputId: string
    label: string
    description: string
    selectValue: string
    inputValue: string
    options: Option[]
    placeholderText?: string
}

interface Emits {
    (e: "update:selectValue", value: string): void
    (e: "update:inputValue", value: string): void
    (e: "change"): void
}

const props = withDefaults(defineProps<Props>(), {
    placeholderText: ""
});

const emit = defineEmits<Emits>();

const selectValue = computed({
    get: () => props.selectValue,
    set: (value: string) => emit("update:selectValue", value)
});

const inputValue = computed({
    get: () => props.inputValue,
    set: (value: string) => emit("update:inputValue", value)
});

const handleChange = () => {
    emit("change");
};
</script>