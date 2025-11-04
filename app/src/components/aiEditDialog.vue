<template>
  <DialogContent>
    <template #content>
      <input
        ref="nameInput"
        class="b3-text-field fn__block"
        :placeholder="siyuanI18n.memo"
        v-model="localName"
      />
      <div class="fn__hr"></div>
      <textarea
        ref="customTextarea"
        class="b3-text-field fn__block"
        :placeholder="siyuanI18n.aiCustomAction"
        v-model="localMemo"
      ></textarea>
    </template>
    <template #actions>
      <button class="b3-button b3-button--remove" @click="handleDelete">{{ siyuanI18n.delete }}</button>
      <div class="fn__space"></div>
      <button class="b3-button b3-button--cancel" @click="handleCancel">{{ siyuanI18n.cancel }}</button>
      <div class="fn__space"></div>
      <button class="b3-button b3-button--text" @click="handleConfirm">{{ siyuanI18n.confirm }}</button>
    </template>
  </DialogContent>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import DialogContent from './common/DialogContent.vue';
import { siyuanI18n } from '../util/siyuanEnvironments/i18n.getI18n';

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