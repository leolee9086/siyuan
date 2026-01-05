<template>
  <input
    v-if="type === 'input'"
    ref="fieldRef"
    :class="[defaultClass, className]"
    :placeholder="placeholder"
    :value="modelValue"
    :disabled="disabled"
    @input="updateValue"
    @keydown.enter="handleEnter"
  />
  <textarea
    v-else
    ref="fieldRef"
    :class="[defaultClass, className]"
    :placeholder="placeholder"
    :value="modelValue"
    :disabled="disabled"
    @input="updateValue"
    @keydown.ctrl.enter="handleCtrlEnter"
    @keydown.enter="handleEnter"
  ></textarea>
</template>

<script setup lang="ts">
import { ref } from "vue";

// 定义组件属性
interface Props {
  modelValue: string;
  placeholder: string;
  type: "input" | "textarea";
  className?: string;
  defaultClass?: string;
  disabled?: boolean;
}

// 定义组件事件
interface Emits {
  (e: "update:modelValue", value: string): void;
  (e: "ctrlEnter"): void;
  (e: "enter"): void;
}

const props = withDefaults(defineProps<Props>(), {
  className: "",
  defaultClass: "b3-text-field fn__block",
  disabled: false
});
const emit = defineEmits<Emits>();

// 引用DOM元素
const fieldRef = ref<HTMLInputElement | HTMLTextAreaElement>();

// 更新方法
const updateValue = (event: Event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  emit("update:modelValue", target.value);
};

// 处理Ctrl+Enter事件
const handleCtrlEnter = () => {
  if (props.type === "textarea") {
    emit("ctrlEnter");
  }
};

// 处理Enter事件
const handleEnter = (event: KeyboardEvent) => {
  if (props.type === "textarea") {
    // 对于textarea，只有Ctrl+Enter才触发事件，普通Enter用于换行
    return;
  }
  // 对于input，触发enter事件
  emit("enter");
};

// 暴露方法给父组件
defineExpose({
  focus: () => {
    if (fieldRef.value) {
      fieldRef.value.focus();
    }
  }
});
</script>