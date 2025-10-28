<template>
  <div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel" @click="handleCancel">{{ languages.cancel }}</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" @click="handleUse">{{ languages.use }}</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" @click="handleSave">{{ languages.save }}</button>
  </div>
</template>

<script setup lang="ts">
// 定义组件事件
interface Emits {
  (e: 'cancel'): void;
  (e: 'use'): void;
  (e: 'save'): void;
}

const emit = defineEmits<Emits>();

// 获取语言包
const languages = window.siyuan.languages;

// 事件处理函数
const handleCancel = () => {
  emit('cancel');
};

const handleUse = () => {
  emit('use');
};

const handleSave = () => {
  emit('save');
};
</script>