import { ref, onMounted, nextTick } from 'vue';
import { siyuanI18n } from '../util/siyuanEnvironments/i18n.getI18n';

// 定义组件事件类型
export interface AiCustomDialogEvents {
  cancel: () => void;
  use: (customAction: string) => void;
  save: (name: string, customAction: string) => void;
}

// 创建组件逻辑
export function useAiCustomDialog(events: AiCustomDialogEvents) {
  // 本地数据
  const localName = ref('');
  const localCustomAction = ref('');

  // 引用DOM元素
  const nameInput = ref<HTMLInputElement>();

  // 获取语言包
  const languages = siyuanI18n;

  // 事件处理函数
  const handleCancel = () => {
    events.cancel();
  };

  const handleUse = () => {
    if (!localCustomAction.value.trim()) {
      // 显示错误消息
      if (window.showMessage) {
        window.showMessage(languages["_kernel"][142], 6000, "error");
      }
      return;
    }
    events.use(localCustomAction.value);
  };

  const handleSave = () => {
    if (!localName.value.trim() && !localCustomAction.value.trim()) {
      // 显示错误消息
      if (window.showMessage) {
        window.showMessage(languages["_kernel"][142], 6000, "error");
      }
      return;
    }
    events.save(localName.value, localCustomAction.value);
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

  return {
    localName,
    localCustomAction,
    nameInput,
    handleCancel,
    handleUse,
    handleSave,
    focusNameInput
  };
}