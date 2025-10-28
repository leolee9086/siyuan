<template>
  <div class="b3-dialog__content">
    <textarea 
      ref="chatTextarea"
      class="b3-text-field fn__block" 
      :placeholder="languages.aiWriting"
      v-model="chatMessage"
      @keydown.enter.exact.prevent="handleConfirm"
    ></textarea>
  </div>
  <div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel" @click="handleCancel">{{ languages.cancel }}</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" @click="handleConfirm">{{ languages.confirm }}</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';

// 定义组件事件
interface Emits {
  (e: 'cancel'): void;
  (e: 'confirm', message: string): void;
}

const emit = defineEmits<Emits>();

// 本地数据
const chatMessage = ref('');

// 引用DOM元素
const chatTextarea = ref<HTMLTextAreaElement>();

// 获取语言包
const languages = window.siyuan.languages;

// 事件处理函数
const handleCancel = () => {
  emit('cancel');
};

const handleConfirm = () => {
  emit('confirm', chatMessage.value);
};

// 聚焦到输入框的方法
const focusChatInput = () => {
  if (chatTextarea.value) {
    chatTextarea.value.focus();
  }
};

// 组件挂载后聚焦到输入框
onMounted(() => {
  nextTick(() => {
    focusChatInput();
  });
});
</script>