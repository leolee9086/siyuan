<template>
  <div class="input-wrapper">
    <div class="global-input">
      <textarea
        v-model="modelProxy"
        class="neon-input"
        :placeholder="props.placeholder"
        :disabled="isInputDisabled"
        @keydown="onKeydown"
      />

      <button
        type="button"
        class="neon-button"
        :aria-label="buttonAriaLabel"
        :disabled="isButtonDisabled"
        @click="onButtonClick"
      >
        {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from "vue";
import { useMagiInputBarContext } from "./MagiInputBar.ctx";
import type { MagiInputBarEmits, MagiInputBarProps } from "./MagiInputBar.types";
import "./MagiInputBar.css";

const props = withDefaults(defineProps<MagiInputBarProps>(), {
  placeholder: "输入指令...",
});

const emit = defineEmits<MagiInputBarEmits>();

const {
  modelProxy,
  isInputDisabled,
  isButtonDisabled,
  buttonText,
  buttonAriaLabel,
  onKeydown,
  onButtonClick,
} = await useMagiInputBarContext({
  modelValue: toRef(props, "modelValue"),
  isLoading: toRef(props, "isLoading"),
  emit,
});
</script>
