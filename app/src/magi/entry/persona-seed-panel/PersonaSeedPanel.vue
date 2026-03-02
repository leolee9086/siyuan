<template>
  <div class="persona-seed-overlay" @click.self="emit('close')">
    <section class="persona-seed-panel">
      <header class="persona-seed-header">
        <h3>适格者 PERSONA 录入</h3>
        <button type="button" class="persona-seed-close" @click="emit('close')">CLOSE</button>
      </header>

      <PersonaSeedSubjectForm
        v-model:subject-id="subjectId" v-model:subject-name="subjectName"
        v-model:subject-type="subjectType" v-model:organization="organization"
        v-model:role="role" v-model:career-goal="careerGoal"
      />

      <PersonaSeedDescriptionsForm
        v-model:professional="professionalDescription"
        v-model:life="lifeDescription"
        v-model:instinct="instinctNeedsDescription"
        v-model:integrated="integratedDescription"
      />

      <PersonaSeedConvergencePanel
        :state="convergenceSession.state" :pending-count="pendingSuggestionCount"
        :accepted-count="acceptedSuggestionCount" :rejected-count="rejectedSuggestionCount"
        :progress-text="descriptionProgressText" :generating="isGeneratingDescriptionToQuestionnaire"
        :suggestions="pendingSuggestions" :summary="viewingSuggestionSummary"
        @generate="generateDescriptionToQuestionnaire" @accept="acceptSuggestion"
        @reject="rejectSuggestion" @view="viewSuggestion"
      />

      <Suspense>
        <template #default>
          <CompositeRating
            :key="ratingKey" :question-bank="questionBank" :subject="subjectMeta"
            :ipip-answers="answers" :focus-question-q="focusQuestionQ"
            :focus-question-request-id="focusQuestionRequestId"
            @update:ipip-answer="onAnswerUpdated" @submit:ipip="onSubmitIpip"
          />
        </template>
        <template #fallback>
          <div class="persona-seed-loading">问卷加载中...</div>
        </template>
      </Suspense>

      <div class="persona-seed-footer">
        <span v-if="statusMessage" class="persona-seed-status">{{ statusMessage }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import CompositeRating from "../../components/persona/CompositeRating.vue";
import PersonaSeedSubjectForm from "./components/PersonaSeedSubjectForm.vue";
import PersonaSeedDescriptionsForm from "./components/PersonaSeedDescriptionsForm.vue";
import PersonaSeedConvergencePanel from "./components/PersonaSeedConvergencePanel.vue";
import { usePersonaSeedPanelContext } from "./PersonaSeedPanel.ctx";
import "./PersonaSeedPanel.css";

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved", filePath: string): void;
}>();

const {
  subjectId, subjectName, subjectType, organization, role, careerGoal,
  professionalDescription, lifeDescription, instinctNeedsDescription, integratedDescription,
  answers, convergenceSession, isGeneratingDescriptionToQuestionnaire,
  focusQuestionQ, focusQuestionRequestId, statusMessage,
  ratingKey, questionBank, subjectMeta,
  pendingSuggestionCount, acceptedSuggestionCount, rejectedSuggestionCount,
  descriptionProgressText, pendingSuggestions, viewingSuggestionSummary,
  onAnswerUpdated, acceptSuggestion, rejectSuggestion, viewSuggestion,
  generateDescriptionToQuestionnaire, onSubmitIpip,
} = usePersonaSeedPanelContext(emit);
</script>
