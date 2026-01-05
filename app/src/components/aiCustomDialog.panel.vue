<template>
  <DialogContent>
    <template #content>
      <ai-custom-dialog-field ref="nameFieldRef" type="input" :placeholder="siyuanI18n.memo" :model-value="localName"
        @update:model-value="updateName" />
      <div class="fn__hr"></div>
      <ai-custom-dialog-field ref="textareaFieldRef" type="textarea" :placeholder="siyuanI18n.aiCustomAction"
        :model-value="localCustomAction" @update:model-value="updateCustomAction" @ctrl-enter="handleUse" />
    </template>
    <template #actions>
      <ai-custom-dialog-buttons @cancel="handleCancel" @use="handleUse" @save="handleSave" />
    </template>
  </DialogContent>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { useAiCustomDialog, type AiCustomDialogEvents } from "./aiCustomDialog.componentLogic";
import AiCustomDialogField from "./common/TextField.vue";
import AiCustomDialogButtons from "./common/DialogActions.vue";
import DialogContent from "./common/DialogContent.vue";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

// 定义组件事件
interface Emits {
  (e: "cancel"): void;
  (e: "use", customAction: string): void;
  (e: "save", name: string, customAction: string): void;
}

const emit = defineEmits<Emits>();

// 获取语言包
const languages = siyuanI18n;

// 创建组件逻辑
const events: AiCustomDialogEvents = {
  cancel: () => emit("cancel"),
  use: (customAction: string) => emit("use", customAction),
  save: (name: string, customAction: string) => emit("save", name, customAction)
};

const {
  localName,
  localCustomAction,
  focusNameInput,
  handleCancel,
  handleUse,
  handleSave
} = useAiCustomDialog(events);

// 引用子组件
const nameFieldRef = ref();
const textareaFieldRef = ref();

// 聚焦到输入框的方法
const focusNameInputWrapper = () => {
  if (nameFieldRef.value) {
    nameFieldRef.value.focus();
  }
};

// 组件挂载后聚焦到输入框
onMounted(() => {
  nextTick(() => {
    focusNameInputWrapper();
  });
});

// 更新方法
const updateName = (value: string) => {
  localName.value = value;
};

const updateCustomAction = (value: string) => {
  localCustomAction.value = value;
};

// 暴露方法给父组件
defineExpose({
  focusNameInput: focusNameInputWrapper
});
</script>