<template>
    <div class="fn__flex b3-label config__item">
        <div class="fn__flex-1">
            {{ label }}
            <div class="b3-label__text" v-html="description"></div>
        </div>
        <span class="fn__space"></span>
        <input
            class="b3-text-field fn__flex-center fn__size200"
            :id="id"
            type="text"
            v-model="modelValue"
            @change="handleChange"
            :placeholder="placeholder"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
    id: string
    label: string
    description: string
    modelValue: string
    placeholder?: string
}

interface Emits {
    (e: 'update:modelValue', value: string): void
    (e: 'change'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const modelValue = computed({
    get: () => props.modelValue,
    set: (value: string) => emit('update:modelValue', value)
})

const handleChange = () => {
    emit('change')
}
</script>