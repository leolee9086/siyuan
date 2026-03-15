<template>
    <div class="vote-content">
        <div class="vote-header">
            <span class="vote-timestamp">{{ votePrefixText }} {{ formattedTime }}</span>
            <span class="vote-conclusion" :class="conclusionClass">
                {{ decision }}
            </span>
        </div>
        <div class="vote-meta">Round {{ round }}</div>
        <div v-if="hasReason" class="vote-reason">理由: {{ reasonText }}</div>
    </div>
</template>

<script setup lang="ts">
import type { VoteMeta } from "./SeelPanel.types";
import { useVoteContentCtx } from "./SeelPanelVoteContent.ctx";
import { getMagiI18nText } from "../../utils/magiI18n";

const props = defineProps<{
    /** 投票元数据 */
    meta: VoteMeta;
    /** 消息时间戳 */
    timestamp: number;
}>();

const {
    decision,
    round,
    conclusionClass,
    reasonText,
    hasReason,
    formattedTime,
} = await useVoteContentCtx(props);
const votePrefixText = getMagiI18nText("voteStatusPrefix");
</script>
