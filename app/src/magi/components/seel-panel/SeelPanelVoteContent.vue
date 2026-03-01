<template>
    <div class="vote-content">
        <div class="vote-header">
            <span class="vote-timestamp">{{ votePrefixText }} {{ formattedTime }}</span>
            <span class="vote-conclusion" :class="conclusionClass">
                {{ displayConclusion }}
            </span>
        </div>
        <div class="vote-meta">
            <div
                v-for="(score, idx) in scores"
                :key="idx"
                class="score-item"
            >
                <div class="target-info">
                    <span class="seel-index">
                        {{ String(idx + 1).padStart(2, "0") }}
                    </span>
                    <div class="seel-details">
                        <div class="seel-name">{{ getSeelName(score.targetIndex) }}</div>
                        <div class="seel-role">{{ getSeelRole(score.targetIndex) }}</div>
                    </div>
                </div>
                <div class="score-bar">
                    <div
                        class="score-fill"
                        :style="{ width: `${score.score * 10}%` }"
                    />
                    <span class="score-value">{{ score.score }}</span>
                </div>
                <span class="decision" :class="getDecisionClass(score.decision)">
                    {{ score.decision || pendingText }}
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { VoteMeta, SeelData } from "./SeelPanel.types";
import { useVoteContentCtx } from "./SeelPanelVoteContent.ctx";
import { getMagiI18nText } from "../../utils/magiI18n";

const props = defineProps<{
    /** 投票元数据 */
    meta: VoteMeta;
    /** 消息时间戳 */
    timestamp: number;
    /** 贤者列表（用于解析名称和角色） */
    seels: SeelData[];
}>();

const {
    scores,
    displayConclusion,
    conclusionClass,
    formattedTime,
    getSeelName,
    getSeelRole,
    getDecisionClass,
} = await useVoteContentCtx(props);
const pendingText = getMagiI18nText("pending");
const votePrefixText = getMagiI18nText("voteStatusPrefix");
</script>
