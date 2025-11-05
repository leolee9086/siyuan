<template>
  <div class="parameter-control">
    <div class="parameter-header">
      <label class="parameter-label">{{ label }}</label>
      <span class="parameter-value">{{ displayValue }}</span>
    </div>
    <input 
      type="range" 
      :value="modelValue"
      @input="handleInput"
      :min="min" 
      :max="max" 
      :step="step"
      :disabled="disabled"
      class="parameter-slider"
    />
    <div class="parameter-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label: string
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  hint?: string
  formatValue?: (value: number) => string | number
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 1,
  step: 0.01,
  disabled: false,
  hint: '',
  formatValue: (value: number) => value
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const displayValue = computed(() => {
  return props.formatValue(props.modelValue)
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', Number(target.value))
}
</script>