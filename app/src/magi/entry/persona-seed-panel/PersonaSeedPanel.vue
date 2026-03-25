<template>
  <div class="persona-seed-overlay" @click.self="emit('close')">
    <section class="persona-seed-panel">
      <header class="persona-seed-header">
        <h3>适格者 PERSONA 录入</h3>
        <div class="persona-seed-header-actions">
          <button type="button" class="persona-seed-import" @click="triggerImportProfile">
            IMPORT PROFILE
          </button>
          <button type="button" class="persona-seed-close" @click="emit('close')">CLOSE</button>
        </div>
      </header>
      <input
        ref="importInputRef"
        class="persona-seed-import-input"
        type="file"
        accept="application/json,.json"
        @change="onImportProfileSelected"
      >
      <p class="persona-seed-policy-tip">
        规则说明：工作空间主管AI一旦完成构建，不可删除，仅可持续调整。
      </p>
      <section class="persona-seed-runtime-state" :class="`persona-seed-runtime-state--${configLoadState}`">
        <div class="persona-seed-runtime-state-title">ACTUAL CONFIG STATE</div>
        <div class="persona-seed-runtime-state-message">{{ configLoadMessage }}</div>
        <div v-if="activeProfilePath" class="persona-seed-runtime-state-path">
          PROFILE: {{ activeProfilePath }}
        </div>
        <div v-if="activeSamplePath" class="persona-seed-runtime-state-path">
          SAMPLE: {{ activeSamplePath }}
        </div>
      </section>
      <PersonaSeedSubjectForm v-model:subject-id="subjectId" v-model:subject-name="subjectName"
        v-model:gender="gender" v-model:age="age" v-model:subject-type="subjectType" v-model:organization="organization"
        v-model:role="role" v-model:career-goal="careerGoal" v-model:profession="profession"
        v-model:primary-social-relation="primarySocialRelation" v-model:self-name="selfName" />
      <PersonaSeedDescriptionsForm v-model:professional="professionalDescription" v-model:life="lifeDescription"
        v-model:instinct="instinctNeedsDescription" v-model:integrated="integratedDescription"
        :generating-questionnaire-to-description="isGeneratingQuestionnaireToDescription"
        :can-generate-trinity-suggestion="canGenerateTrinitySuggestion"
        @generate-questionnaire-to-description="generateQuestionnaireToDescription" />
      <PersonaSeedConvergencePanel
        :state="convergenceSession.state" :pending-count="pendingSuggestionCount"
        :accepted-count="acceptedSuggestionCount" :rejected-count="rejectedSuggestionCount"
        :progress-text="descriptionProgressText"
        :generating-description-to-questionnaire="isGeneratingDescriptionToQuestionnaire"
        :generating-questionnaire-to-description="isGeneratingQuestionnaireToDescription"
        :suggestions="pendingSuggestions" :summary="viewingSuggestionSummary"
        :description-diff="viewingDescriptionDiff"
        @generate-description-to-questionnaire="generateDescriptionToQuestionnaire"
        @generate-questionnaire-to-description="generateQuestionnaireToDescription"
        @accept="acceptSuggestion"
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
import { ref } from "vue";
import CompositeRating from "../../components/persona/CompositeRating.vue";
import PersonaSeedSubjectForm from "./components/PersonaSeedSubjectForm.vue";
import PersonaSeedDescriptionsForm from "./components/PersonaSeedDescriptionsForm.vue";
import PersonaSeedConvergencePanel from "./components/PersonaSeedConvergencePanel.vue";
import { usePersonaSeedPanelContext } from "./PersonaSeedPanel.ctx";
import type { PersonaSeedSavedPayload } from "./PersonaSeedPanel.types";
import "./PersonaSeedPanel.css";

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved", payload: PersonaSeedSavedPayload): void;
}>();

const {
  subjectId, subjectName, gender, age, subjectType, organization, role, careerGoal,
  profession, primarySocialRelation, selfName,
  professionalDescription, lifeDescription, instinctNeedsDescription, integratedDescription,
  answers, convergenceSession,
  isGeneratingDescriptionToQuestionnaire, isGeneratingQuestionnaireToDescription,
  focusQuestionQ, focusQuestionRequestId, statusMessage,
  configLoadState, configLoadMessage, activeProfilePath, activeSamplePath,
  ratingKey, questionBank, subjectMeta,
  pendingSuggestionCount, acceptedSuggestionCount, rejectedSuggestionCount,
  descriptionProgressText, pendingSuggestions, viewingSuggestionSummary, viewingDescriptionDiff,
  canGenerateTrinitySuggestion,
  onAnswerUpdated, acceptSuggestion, rejectSuggestion, viewSuggestion,
  generateDescriptionToQuestionnaire, generateQuestionnaireToDescription, onSubmitIpip,
  importPersonaProfile,
} = usePersonaSeedPanelContext(emit);

const importInputRef = ref<HTMLInputElement | null>(null);

function triggerImportProfile(): void {
  importInputRef.value?.click();
}

function isFileInputElement(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement;
}

async function onImportProfileSelected(event: Event): Promise<void> {
  if (!isFileInputElement(event.target)) {
    return;
  }
  const input = event.target;
  const file = input.files?.[0] ?? null;
  if (!file) {
    return;
  }
  await importPersonaProfile(file);
  if (input) {
    input.value = "";
  }
}
</script>
