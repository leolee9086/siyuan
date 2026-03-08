import { computed } from "vue";
import type {
  MagiInputBarContext,
  UseMagiInputBarContextParams,
} from "./MagiInputBar.types";

/**
 * 触发输入栏主动作
 *
 * 作用：统一处理按钮点击与回车触发时的 submit/stop 分支。
 * 意图：避免事件入口分散导致行为不一致。
 * 调用时机：点击发送按钮或按下 Enter（非 Shift+Enter）时调用。
 */
function triggerPrimaryAction(params: UseMagiInputBarContextParams): void {
  // 流式响应期间主按钮语义切换为“停止”，优先中断生成过程。
  if (params.isLoading.value) {
    params.emit("stop");
    return;
  }

  const normalized = params.modelValue.value.trim();
  if (!normalized) {
    return;
  }

  params.emit("submit", normalized);
}

/**
 * 读取 v-model 当前值
 *
 * 作用：为 computed modelProxy 提供 getter。
 * 意图：保持模板层使用 v-model，同时将真实状态源保持在父组件。
 * 调用时机：模板渲染和输入值同步时由 Vue 响应式系统调用。
 */
function getModelProxyValue(params: UseMagiInputBarContextParams): string {
  return params.modelValue.value;
}

/**
 * 回写 v-model 新值
 *
 * 作用：将子组件输入变更通过 update:modelValue 事件向上传递。
 * 意图：实现受控输入，保证数据流单向可追踪。
 * 调用时机：textarea 内容变化时由 Vue v-model setter 调用。
 */
function setModelProxyValue(
  params: UseMagiInputBarContextParams,
  value: string
): void {
  if (params.modelValue.value === value) {
    return;
  }
  params.emit("update:modelValue", value);
}

/**
 * 处理键盘提交行为
 *
 * 作用：实现 Enter 发送、Shift+Enter 换行。
 * 意图：保持聊天输入交互与原型一致。
 * 调用时机：textarea 的 keydown 事件触发时调用。
 */
function handleInputKeydown(
  params: UseMagiInputBarContextParams,
  event: KeyboardEvent
): void {
  if (event.key !== "Enter") {
    return;
  }

  if (event.shiftKey) {
    return;
  }

  event.preventDefault();
  triggerPrimaryAction(params);
}

/**
 * 输入栏上下文
 *
 * 作用：集中装配输入栏的响应式状态与事件处理函数。
 * 意图：将组件脚本保持为装配层，便于复用与测试。
 * 调用时机：MagiInputBar 组件 setup 阶段调用一次。
 */
export async function useMagiInputBarContext(
  params: UseMagiInputBarContextParams
): Promise<MagiInputBarContext> {
  const modelProxy = computed<string>({
    get: getModelProxyValue.bind(null, params),
    set: setModelProxyValue.bind(null, params),
  });

  const isInputDisabled = computed(() => params.isLoading.value);

  const isButtonDisabled = computed(() => {
    if (params.isLoading.value) {
      return false;
    }
    return params.modelValue.value.trim() === "";
  });

  const buttonText = computed(() => (params.isLoading.value ? "停止" : "发送"));

  const buttonAriaLabel = computed(() =>
    params.isLoading.value ? "停止生成" : "发送消息"
  );

  return {
    modelProxy,
    isInputDisabled,
    isButtonDisabled,
    buttonText,
    buttonAriaLabel,
    onKeydown: handleInputKeydown.bind(null, params),
    onButtonClick: triggerPrimaryAction.bind(null, params),
  };
}
