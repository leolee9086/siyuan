<template>
  <div class="composite-rating">
    <template v-if="isIpipMode">
      <div class="ipip-header"><div class="ipip-progress-text">{{ answeredCount }}/{{ totalQuestions }}</div><div class="ipip-progress-track"><div class="ipip-progress-fill" :style="{ width: `${progressPercent}%` }"></div></div></div>
      <div v-if="currentIpipQuestion" class="ipip-question">
        <p class="ipip-question-index">Q{{ currentQuestionIndex + 1 }}</p><p class="ipip-question-text">{{ currentIpipQuestion.text }}</p>
        <div class="likert-options"><button v-for="score in likertScores" :key="score" class="likert-option" :class="{ selected: currentLikertScore === score }" type="button" @click="selectLikertOption(score)">{{ score }}</button></div>
      </div>
      <div class="ipip-actions"><button type="button" :disabled="!canGoPrev" @click="goPrevQuestion">上一题</button><button type="button" :disabled="!canGoNext" @click="goNextQuestion">下一题</button><button type="button" :disabled="!allLikertAnswered" @click="submitIpipAnswers">提交</button></div>
    </template>
    <template v-else>
      <p v-if="question?.hint" class="question-hint">{{ question.hint }}</p>
      <div v-if="question" class="sub-questions">
        <div v-for="(subQuestion, index) in question.subQuestions" :key="index" class="sub-question">
          <p>{{ subQuestion.text }}</p>
          <div class="options"><div v-for="(option, optIndex) in subQuestion.options" :key="optIndex" class="option-item" :class="{ 'selected': selections.get(index) === optIndex }" @click="selectOption(index, optIndex)">{{ option }}</div></div>
        </div>
      </div>
      <div v-if="allAnswered" class="score-display"><div class="score-label">{{ compositeScoreText }}：</div><div class="score-value">{{ currentScore }}%</div></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CompositeRatingProps, CompositeRatingEmits } from "./CompositeRating.types";
import { useCompositeRatingCtx } from "./CompositeRating.ctx";
import { getMagiI18nText } from "../../utils/magiI18n";
import "./CompositeRating.css";

const props = defineProps<CompositeRatingProps>();
const emit = defineEmits<CompositeRatingEmits>();
const compositeScoreText = getMagiI18nText("compositeScore");

const likertScores = [1, 2, 3, 4, 5] as const;

const {
    selections,
    currentScore,
    allAnswered,
    selectOption,
    isIpipMode,
    currentQuestionIndex,
    totalQuestions,
    currentIpipQuestion,
    progressPercent,
    canGoPrev,
    canGoNext,
    currentLikertScore,
    answeredCount,
    allLikertAnswered,
    selectLikertOption,
    goPrevQuestion,
    goNextQuestion,
    submitIpipAnswers,
} = await useCompositeRatingCtx(props, emit);
</script>
