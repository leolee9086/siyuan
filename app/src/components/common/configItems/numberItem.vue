<template>
    <div class="fn__flex b3-label config__item">
        <div class="fn__flex-1">
            {{ label }}
            <div class="b3-label__text" v-html="description"></div>
        </div>
        <span class="fn__space"></span>
        <div v-if="suffix" class="fn__size200 fn__flex-center fn__flex">
            <input
                class="b3-text-field fn__flex-1"
                :id="id"
                type="number"
                :min="min"
                :max="max"
                v-model.number="modelValue"
                @change="handleChange"
            />
            <span class="fn__space"></span>
            <span class="ft__on-surface fn__flex-center">{{ suffix }}</span>
        </div>
        <input
            v-else
            class="b3-text-field fn__flex-center fn__size200"
            :id="id"
            type="number"
            :min="min"
            :max="max"
            v-model.number="modelValue"
            @change="handleChange"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
    id: string
    label: string
    description: string
    min: number
    max: number
    suffix?: string
    modelValue: number
    customHandler?: (() => void)|undefined
}

interface Emits {
    (e: "update:modelValue", value: number): void
    (e: "change"): void
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const modelValue = computed({
    get: () => props.modelValue,
    set: (value: number) => emit("update:modelValue", value)
});

const handleChange = () => {
    if (props.customHandler) {
        props.customHandler();
    } else {
        emit("change");
    }
};
</script>