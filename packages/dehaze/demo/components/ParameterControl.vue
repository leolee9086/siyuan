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

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  modelValue: {
    type: Number,
    required: true
  },
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 1
  },
  step: {
    type: Number,
    default: 0.01
  },
  disabled: {
    type: Boolean,
    default: false
  },
  hint: {
    type: String,
    default: ''
  },
  formatValue: {
    type: Function,
    default: (value) => value
  }
})

const emit = defineEmits(['update:modelValue'])

const displayValue = computed(() => {
  return props.formatValue(props.modelValue)
})

const handleInput = (event) => {
  emit('update:modelValue', Number(event.target.value))
}
</script> 