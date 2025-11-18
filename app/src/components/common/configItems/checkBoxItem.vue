<template>
    <label class="fn__flex b3-label">
        <div class="fn__flex-1">
            {{ label }}
            <div class="b3-label__text" v-html="description"></div>
        </div>
        <span class="fn__space"></span>
        <input
            class="b3-switch fn__flex-center"
            :id="id"
            type="checkbox"
            v-model="modelValue"
            @change="handleChange"
        />
    </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
    id: string
    label: string
    description: string
    modelValue: boolean
}

interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'change'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const modelValue = computed({
    get: () => props.modelValue,
    set: (value: boolean) => emit('update:modelValue', value)
})

const handleChange = () => {
    emit('change')
}
</script>