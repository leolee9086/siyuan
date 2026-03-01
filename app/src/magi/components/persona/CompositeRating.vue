<template>
  <div class="composite-rating">
    <p v-if="question.hint" class="question-hint">{{ question.hint }}</p>
    <div class="sub-questions">
      <div
        v-for="(subQuestion, index) in question.subQuestions"
        :key="index"
        class="sub-question"
      >
        <p>{{ subQuestion.text }}</p>
        <div class="options">
          <div
            v-for="(option, optIndex) in subQuestion.options"
            :key="optIndex"
            class="option-item"
            :class="{ 'selected': selections.get(index) === optIndex }"
            @click="selectOption(index, optIndex)"
          >
            {{ option }}
          </div>
        </div>
      </div>
    </div>
    <div v-if="allAnswered" class="score-display">
      <div class="score-label">{{ compositeScoreText }}：</div>
      <div class="score-value">{{ currentScore }}%</div>
    </div>
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

const { selections, currentScore, allAnswered, selectOption } =
    await useCompositeRatingCtx(props, emit);
</script>
