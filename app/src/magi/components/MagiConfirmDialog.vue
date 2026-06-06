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

