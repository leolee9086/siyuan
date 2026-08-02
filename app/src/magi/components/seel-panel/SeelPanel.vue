<template>
  <div
    ref="panelContainer"
    class="seel-panel"
    :class="{
      'seel-panel-event-active': isEventActive,
      'seel-panel-vote-active': !!visibleVoteBadge,
    }"
    :style="rootStyle"
  >
    <SeelPanelSvgFrame
      :config-name="ai.config.name"
      :color="colorValue"
      :show-frame="showFrame"
      :header-divider-y="headerDividerY"
    />
    <SeelPanelHeader
      :icon="ai.config.icon"
      :config-name="ai.config.name"
      :persona="ai.config.persona"
      :status-class="statusClass"
      :status-text="statusText"
    />
    <div
      v-if="visibleVoteBadge"
      class="seel-vote-badge"
      :class="`tone-${visibleVoteBadge.tone}`"
      :title="visibleVoteBadge.tooltip"
      @click.stop="dismissVoteBadges"
    >
      <svg class="seel-vote-badge-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="seel-vote-badge-stroke" d="M5,0 H95 L100,5 V95 L95,100 H5 L0,95 V5 L5,0 Z" />
      </svg>
      <div class="seel-vote-badge-content">
        <span class="seel-vote-badge-text">{{ visibleVoteBadge.label }}</span>
        <div v-if="visibleVoteBadge.proposedAction || visibleVoteBadge.reason || visibleVoteBadge.deliberationReason" class="seel-vote-badge-detail">
          <span v-if="visibleVoteBadge.proposedAction" class="seel-vote-badge-action">{{ visibleVoteBadge.proposedAction }}</span>
          <span v-if="visibleVoteBadge.reason" class="seel-vote-badge-reason">理由: {{ visibleVoteBadge.reason }}</span>
          <span v-else-if="visibleVoteBadge.deliberationReason" class="seel-vote-badge-reason">动机: {{ visibleVoteBadge.deliberationReason }}</span>
        </div>
      </div>
    </div>
    <div class="panel-content">
      <transition name="panel-slide">
        <VirtualMasonryGrid
          v-show="showMessages"
          ref="messageListRef"
          class="seel-message-container secondary-output"
          :items="virtualItems"
          id-key="virtualId"
          mode="list"
          :gap="9"
          :overscan-by="1"
          :item-height="estimateMessageHeight"
          :managed-by-provider="true"
          :follow-output="true"
        >
          <template #default="{ item }">
            <div v-if="item.kind === 'loading'" class="loading-animation">
              <div class="pulse-dot" />
              <div class="pulse-bar" />
            </div>
            <MessageBubble
              v-else
              :type="item.message.type"
              :status="item.message.status"
              :timestamp="item.message.timestamp"
              :msg="item.message"
              @cursor-update="handleCursorUpdate"
            >
              <SeelPanelVoteContent
                v-if="item.message.type === 'vote'"
                :meta="item.message.meta ?? {}"
                :timestamp="item.message.timestamp"
              />
              <template v-else-if="isToolActivity(item.message)">
                <div class="tool-call-block">
                  <div class="tool-call-header">
                    <span>{{ getToolName(item.message.meta ?? {}) }}</span>
                    <span
                      class="tool-call-phase"
                      :class="`phase-${getToolPhase(item.message.meta ?? {})}`"
                    >{{ getToolPhaseLabel(item.message.meta ?? {}) }}</span>
                  </div>
                  <details class="tool-call-args">
                    <summary class="tool-call-args-summary">
                      <span>参数</span>
                      <span v-if="item.message.meta?.argumentsComplete" class="args-status complete">✓ 完整</span>
                      <span v-else class="args-status building">⋯ 构建中</span>
                    </summary>
                    <pre class="tool-call-args-content">{{ formatToolCallArgs(item.message.meta ?? {}) }}</pre>
                  </details>
                  <div
                    v-if="getToolOutput(item.message.meta ?? {})"
                    class="tool-call-output"
                    :class="{ 'is-error': getToolPhase(item.message.meta ?? {}) === 'failed' }"
                  >
                    <span class="tool-call-output-label">
                      {{ getToolPhase(item.message.meta ?? {}) === "failed" ? "错误" : "结果" }}
                    </span>
                    <pre class="tool-call-output-content">{{ getToolOutput(item.message.meta ?? {}) }}</pre>
                  </div>
                </div>
              </template>
              <template v-else>
                <MagiWebContent
                  class="protyle-wysiwyg"
                  :content="item.message.content"
                  v-bind="item.message.meta ? { meta: item.message.meta } : {}"
                />
              </template>
            </MessageBubble>
          </template>
        </VirtualMasonryGrid>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 用途：组件事件契约。使用范围：投票徽标消隐。解耦评估：仅描述组件公开边界。 */
import type { SeelPanelEmits } from "./SeelPanel.types";
/** 用途：组件属性契约。使用范围：三贤人卡片输入。解耦评估：同目录稳定类型。 */
import type { SeelPanelProps } from "./SeelPanel.types";
/** 用途：聚合卡片响应式逻辑。使用范围：组件 setup。解耦评估：活动流状态属于卡片直接职责。 */
import { useSeelPanelCtx } from "./SeelPanel.ctx";
/** 用途：渲染卡片边框。使用范围：SeelPanel 模板。解耦评估：视觉子组件由卡片直接组合。 */
import SeelPanelSvgFrame from "./SeelPanelSvgFrame.vue";
/** 用途：渲染贤人身份和连接状态。使用范围：SeelPanel 模板。解耦评估：视觉子组件由卡片直接组合。 */
import SeelPanelHeader from "./SeelPanelHeader.vue";
/** 用途：渲染投票消息内容。使用范围：活动流 vote 条目。解耦评估：投票内容是卡片消息的一种展示。 */
import SeelPanelVoteContent from "./SeelPanelVoteContent.vue";
/** 用途：渲染 Markdown 活动内容。使用范围：普通活动条目。解耦评估：通过目录网关隔离父级路径。 */
import { MagiWebContent } from "./imports";
/** 用途：提供聊天式消息外观。使用范围：全部活动条目。解耦评估：通过目录网关隔离兄弟目录路径。 */
import { MessageBubble } from "./imports";
/** 用途：虚拟化线性活动流。使用范围：卡片消息列表。解耦评估：通过列表端口限制逻辑层依赖。 */
import { VirtualMasonryGrid } from "./imports";
/** 用途：加载卡片样式。使用范围：SeelPanel 组件。解耦评估：样式与组件结构一一对应。 */
import "./SeelPanel.css";

const emit = defineEmits<SeelPanelEmits>();
const props = withDefaults(defineProps<SeelPanelProps>(), {
    showMessages: true,
    isDominant: false,
    showFrame: true,
    frameColor: "",
    dismissedVoteBadgeToken: "",
});

const {
    panelContainer, messageListRef, showFrame, statusClass, statusText,
    headerDividerY, rootStyle, virtualItems, colorValue, visibleVoteBadge,
    isEventActive, estimateMessageHeight, isToolActivity, getToolName,
    getToolPhase, getToolPhaseLabel, getToolOutput, formatToolCallArgs,
    handleCursorUpdate, dismissVoteBadges,
} = useSeelPanelCtx(props, emit);

</script>
