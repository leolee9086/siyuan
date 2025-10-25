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
      v-model="localMemo"
    ></textarea>
  </div>
  <div class="b3-dialog__action">
    <button class="b3-button b3-button--remove" @click="handleDelete">{{ languages.delete }}</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--cancel" @click="handleCancel">{{ languages.cancel }}</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" @click="handleConfirm">{{ languages.confirm }}</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';

// 定义组件属性
interface Props {
  name: string;
  memo: string;
}

// 定义组件事件
interface Emits {
  (e: 'cancel'): void;
  (e: 'confirm', name: string, memo: string): void;
  (e: 'delete'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 本地数据
const localName = ref(props.name);
const localMemo = ref(props.memo);

// 引用DOM元素
const nameInput = ref<HTMLInputElement>();
const customTextarea = ref<HTMLTextAreaElement>();

// 获取语言包
const languages = window.siyuan.languages;

// 事件处理函数
const handleCancel = () => {
  emit('cancel');
};

const handleConfirm = () => {
  emit('confirm', localName.value, localMemo.value);
};

const handleDelete = () => {
  emit('delete');
};

// 聚焦到输入框的方法
const focusSearchInput = () => {
  if (nameInput.value) {
    nameInput.value.focus();
  }
};

// 组件挂载后聚焦到输入框
onMounted(() => {
  nextTick(() => {
    focusSearchInput();
  });
});
</script>