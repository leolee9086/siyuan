<template>
  <div class="b3-dialog__content">
    <input 
      ref="nameInput"
      class="b3-text-field fn__block" 
      :placeholder="languages.memo"
      v-model="localName"
    />
    <div class="fn__hr"></div>
    <textarea 
      ref="customTextarea"
      class="b3-text-field fn__block" 
      :placeholder="languages.aiCustomAction"
      v-model="localCustomAction"
      @keydown.ctrl.enter="handleUse"
    ></textarea>
  </div>
  <div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel" @click="handleCancel">{{ languages.cancel }}</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" @click="handleUse">{{ languages.use }}</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" @click="handleSave">{{ languages.save }}</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';

// 定义组件事件
interface Emits {
  (e: 'cancel'): void;
  (e: 'use', customAction: string): void;
  (e: 'save', name: string, customAction: string): void;
}

const emit = defineEmits<Emits>();

// 本地数据
const localName = ref('');
const localCustomAction = ref('');

// 引用DOM元素
const nameInput = ref<HTMLInputElement>();
const customTextarea = ref<HTMLTextAreaElement>();

// 获取语言包
const languages = window.siyuan.languages;

// 事件处理函数
const handleCancel = () => {
  emit('cancel');
};

const handleUse = () => {
  if (!localCustomAction.value.trim()) {
    // 显示错误消息
    if (window.showMessage) {
      window.showMessage(languages["_kernel"][142], 6000, "error");
    }
    return;
  }
  emit('use', localCustomAction.value);
};

const handleSave = () => {
  if (!localName.value.trim() && !localCustomAction.value.trim()) {
    // 显示错误消息
    if (window.showMessage) {
      window.showMessage(languages["_kernel"][142], 6000, "error");
    }
    return;
  }
  emit('save', localName.value, localCustomAction.value);
};

// 聚焦到输入框的方法
const focusNameInput = () => {
  if (nameInput.value) {
    nameInput.value.focus();
  }
};

// 组件挂载后聚焦到输入框
onMounted(() => {
  nextTick(() => {
    focusNameInput();
  });
});

// 暴露方法给父组件
defineExpose({
  focusNameInput
});
</script>