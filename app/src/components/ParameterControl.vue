<template>
  <button :data-id="dataId" class="b3-menu__item b3-menu__item--readonly b3-menu__item--custom" :disabled="disabled">
    <span class="b3-menu__label">{{ label }}</span>
    <div style="margin: 4px 0;" :aria-label="label" class="b3-tooltips b3-tooltips__n">
      <input style="box-sizing: border-box" :value="modelValue" @input="handleInput" :min="min" :max="max" :step="step"
        :disabled="disabled" class="b3-slider fn__block" type="range" />

    </div>
          <span class="b3-menu__label">{{ displayValue }}</span>

  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  label: string
  modelValue: number
  dataId?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  hint?: string
  formatValue?: (value: number) => string | number
}

const props = withDefaults(defineProps<Props>(), {
  dataId: "",
  min: 0,
  max: 1,
  step: 0.01,
  disabled: false,
  hint: "",
  formatValue: (value: number) => value
});

const emit = defineEmits<{
  "update:modelValue": [value: number]
}>();

const displayValue = computed(() => {
  return props.formatValue(props.modelValue);
});

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", Number(target.value));
};
</script>