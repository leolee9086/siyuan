<template>
    <div class="b3-label config__item">
        {{ label }}
        <div class="b3-label__text" v-html="description"></div>
        <span class="fn__hr"></span>
        <select class="b3-select fn__block" :id="id" v-model="modelValue" @change="handleChange">
            <option v-for="option in options" :key="option.value" :value="option.value">
                {{ option.label }}
            </option>
        </select>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Option {
    value: string | number
    label: string
}

interface Props {
    id: string
    label: string
    description: string
    modelValue: string | number
    options: Option[]
}

interface Emits {
    (e: "update:modelValue", value: string | number): void
    (e: "change"): void
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const modelValue = computed({
    get: () => props.modelValue,
    set: (value: string | number) => emit("update:modelValue", value)
});

const handleChange = () => {
    emit("change");
};
</script>
