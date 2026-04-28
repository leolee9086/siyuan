<template>
  <div class="magi-confirm-overlay" @click.self="emit('cancel')">
    <div class="magi-confirm-dialog">
      <div class="magi-confirm-title">{{ title }}</div>
      <div class="magi-confirm-body">{{ body }}</div>
      <div class="magi-confirm-actions">
        <button type="button" class="magi-confirm-btn magi-confirm-btn--primary" @click="emit('confirm')">{{ confirmText }}</button>
        <button type="button" class="magi-confirm-btn" @click="emit('cancel')">{{ cancelText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  body: string;
  confirmText?: string;
  cancelText?: string;
}>();

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<style scoped>
.magi-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.magi-confirm-dialog {
  background: #0a1a22;
  border: 1px solid rgba(72, 205, 255, 0.35);
  padding: 20px;
  max-width: 440px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.magi-confirm-title {
  color: #8deeff;
  font-size: 13px;
  letter-spacing: 0.06em;
}

.magi-confirm-body {
  color: #bff7ff;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.magi-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.magi-confirm-btn {
  height: 28px;
  border: 1px solid rgba(100, 229, 255, 0.4);
  background: rgba(0, 70, 90, 0.28);
  color: #d4fbff;
  padding: 0 14px;
  cursor: pointer;
  font-size: 11px;
}

.magi-confirm-btn--primary {
  border-color: rgba(49, 255, 136, 0.48);
  background: rgba(0, 88, 38, 0.35);
}
</style>
