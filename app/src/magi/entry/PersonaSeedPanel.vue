<template>
  <div class="persona-seed-overlay" @click.self="emit('close')">
    <section class="persona-seed-panel">
      <header class="persona-seed-header">
        <h3>适格者 PERSONA 录入</h3>
        <button type="button" class="persona-seed-close" @click="emit('close')">CLOSE</button>
      </header>

      <div class="persona-seed-subject">
        <label>
          Subject ID
          <input v-model.trim="subjectId" type="text" />
        </label>
        <label>
          Name
          <input v-model.trim="subjectName" type="text" />
        </label>
        <label>
          Type
          <select v-model="subjectType">
            <option value="human">human</option>
            <option value="ai_agent">ai_agent</option>
          </select>
        </label>
        <label>
          Organization
          <input v-model.trim="organization" type="text" />
        </label>
        <label>
          Role
          <input v-model.trim="role" type="text" />
        </label>
        <label>
          Career Goal
          <input v-model.trim="careerGoal" type="text" />
        </label>
      </div>

      <div class="persona-seed-descriptions">
        <label>
          Professional Description (Melchior)
          <textarea
            v-model.trim="professionalDescription"
            rows="4"
            placeholder="职业场景中的能力定位、判断标准、长期职业发展方向。"
          />
        </label>
        <label>
          Life Description (Balthazar)
          <textarea
            v-model.trim="lifeDescription"
            rows="4"
            placeholder="日常生活中的关系偏好、情绪模式、价值取舍。"
          />
        </label>
        <label>
          Instinct Needs Description (Casper)
          <textarea
            v-model.trim="instinctNeedsDescription"
            rows="4"
            placeholder="自身核心需求、边界底线、即时驱动。"
          />
        </label>
        <label>
          Integrated Self Description (Trinity)
          <textarea
            v-model.trim="integratedDescription"
            rows="4"
            placeholder="统一自我叙述，聚焦“我是谁、我想成为什么样的人”。"
          />
        </label>
      </div>

      <div class="persona-seed-convergence">
        <div class="persona-seed-convergence-header">
          <strong>双向收敛建议</strong>
          <span class="persona-seed-convergence-state">
            状态: {{ convergenceSession.state }} / 待确认: {{ pendingSuggestionCount }}
          </span>
        </div>
        <div class="persona-seed-convergence-controls">
          <button
            type="button"
            class="persona-seed-convergence-generate"
            :disabled="isGeneratingDescriptionToQuestionnaire"
            @click="generateDescriptionToQuestionnaire"
          >
            {{ isGeneratingDescriptionToQuestionnaire ? "生成中..." : "描述 -> 问卷建议" }}
          </button>
        </div>
        <p class="persona-seed-convergence-hint">
          当前已接入“描述 -> 问卷建议”LLM 入口；建议默认 pending，需手动确认后写入。
        </p>
        <p class="persona-seed-convergence-progress">
          描述进度: {{ descriptionProgressText }} / 已接受: {{ acceptedSuggestionCount }} / 已拒绝: {{ rejectedSuggestionCount }}
        </p>
        <p v-if="viewingSuggestionSummary" class="persona-seed-suggestion-preview">
          查看中: Q{{ viewingSuggestionSummary.q }} / 当前: {{ viewingSuggestionSummary.currentScoreText }} / 建议: {{ viewingSuggestionSummary.suggestedScore }}
        </p>
        <ul v-if="pendingSuggestions.length > 0" class="persona-seed-suggestion-list">
          <li v-for="suggestion in pendingSuggestions" :key="suggestion.id" class="persona-seed-suggestion-item">
            <div class="persona-seed-suggestion-meta">
              <span>{{ suggestion.source }} -> {{ suggestion.target }}</span>
              <span>{{ suggestion.status }}</span>
            </div>
            <p class="persona-seed-suggestion-reason">{{ suggestion.reason }}</p>
            <div class="persona-seed-suggestion-actions">
              <button
                type="button"
                :disabled="suggestion.status === 'accepted'"
                @click="acceptSuggestion(suggestion.id)"
              >
                接受
              </button>
              <button
                type="button"
                :disabled="suggestion.status === 'rejected'"
                @click="rejectSuggestion(suggestion.id)"
              >
                拒绝
              </button>
              <button
                type="button"
                class="persona-seed-suggestion-view"
                :disabled="suggestion.payload.kind !== 'questionnaire_answer'"
                @click="viewSuggestion(suggestion.id)"
              >
                查看
              </button>
            </div>
          </li>
        </ul>
      </div>

      <Suspense>
        <template #default>
          <CompositeRating :key="ratingKey" :question-bank="questionBank" :subject="subjectMeta" :ipip-answers="answers"
            :focus-question-q="focusQuestionQ"
            :focus-question-request-id="focusQuestionRequestId"
            @update:ipip-answer="onAnswerUpdated" @submit:ipip="onSubmitIpip" />
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
import { computed, ref, watch } from "vue";
import { fetchSyncPost } from "../../util/network/fetch";
import { ipipNeo120QuestionBank } from "../data/ipip-neo-120";
import { buildIpipPersonaProfileFromRawAnswers } from "../data/ipip-neo-120-scoring";
import {
  applySuggestionToAnswers,
  applySuggestionToDescriptions,
  countSuggestionsByStatus,
  createEmptyConvergenceSession,
  restoreConvergenceSession,
  setConvergenceSuggestions,
  transitionConvergenceState,
  updateSuggestionStatus,
} from "../data/convergence/persona-seed-convergence";
import { generateDescriptionToQuestionnaireSuggestions } from "../data/convergence/persona-seed-convergence-llm";
import type {
  IpipNeo120SubmissionPayload,
  IpipSubjectProfile,
  IpipNeo120SubjectMeta,
  IpipPersonaSeedDescriptions,
} from "../data/questionnaire.types";
import type { PersonaConvergenceSession, PersonaConvergenceSuggestion } from "../data/convergence/persona-seed-convergence.types";
import type { QuestionnaireDraft, SubjectType } from "../data/convergence/persona-seed-panel.types";
import type { LikertScore } from "../components/persona/CompositeRating.types";
import CompositeRating from "../components/persona/CompositeRating.vue";
import "./PersonaSeedPanel.css";

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved", filePath: string): void;
}>();

const questionBank = ipipNeo120QuestionBank;

const subjectId = ref("zhi");
const subjectName = ref("ZHI");
const subjectType = ref<SubjectType>("ai_agent");
const organization = ref("");
const role = ref("");
const careerGoal = ref("");
const professionalDescription = ref("");
const lifeDescription = ref("");
const instinctNeedsDescription = ref("");
const integratedDescription = ref("");
const answers = ref<Array<{ q: number; score: LikertScore }>>([]);
const convergenceSession = ref<PersonaConvergenceSession>(createEmptyConvergenceSession());
const isGeneratingDescriptionToQuestionnaire = ref(false);
const focusQuestionQ = ref<number | null>(null);
const focusQuestionRequestId = ref(0);
const viewingSuggestionId = ref("");
const ratingVersion = ref(0);
const statusMessage = ref("");

const ratingKey = computed(() => `${subjectId.value}-${ratingVersion.value}`);
const pendingSuggestionCount = computed(() =>
  countSuggestionsByStatus(convergenceSession.value, "pending"),
);
const acceptedSuggestionCount = computed(() =>
  countSuggestionsByStatus(convergenceSession.value, "accepted"),
);
const rejectedSuggestionCount = computed(() =>
  countSuggestionsByStatus(convergenceSession.value, "rejected"),
);
const pendingSuggestions = computed(() => {
  const suggestions: PersonaConvergenceSuggestion[] = [];
  for (const suggestion of convergenceSession.value.suggestions) {
    if (suggestion.status !== "pending") {
      continue;
    }
    suggestions.push(suggestion);
  }
  return suggestions;
});
const viewingSuggestionSummary = computed(() => {
  const suggestion = getSuggestionById(viewingSuggestionId.value);
  if (!suggestion || suggestion.payload.kind !== "questionnaire_answer") {
    return null;
  }
  if (suggestion.status !== "pending") {
    return null;
  }
  const currentScore = findAnswerScore(suggestion.payload.q);
  return {
    q: suggestion.payload.q,
    currentScoreText: currentScore === null ? "未作答" : String(currentScore),
    suggestedScore: suggestion.payload.score,
  };
});
const descriptionCompletionCount = computed(() => {
  let count = 0;
  if (professionalDescription.value.trim()) {
    count += 1;
  }
  if (lifeDescription.value.trim()) {
    count += 1;
  }
  if (instinctNeedsDescription.value.trim()) {
    count += 1;
  }
  if (integratedDescription.value.trim()) {
    count += 1;
  }
  return count;
});
const descriptionProgressText = computed(() => `${descriptionCompletionCount.value}/4`);
const subjectMeta = computed<IpipNeo120SubjectMeta>(() => ({
  id: subjectId.value || "zhi",
  name: subjectName.value || "zhi",
  type: subjectType.value,
  organization: organization.value,
  role: role.value,
  careerGoal: careerGoal.value,
}));
const seedDescriptions = computed<IpipPersonaSeedDescriptions>(() => ({
  professionalDescription: professionalDescription.value,
  lifeDescription: lifeDescription.value,
  instinctNeedsDescription: instinctNeedsDescription.value,
  integratedDescription: integratedDescription.value,
}));

const getDraftKey = (id: string): string => `magi_questionnaire_draft_${id || "zhi"}`;

const saveDraft = (answers: Array<{ q: number; score: LikertScore }>) => {
  const payload: QuestionnaireDraft = {
    subject: {
      id: subjectId.value || "zhi",
      name: subjectName.value || "zhi",
      type: subjectType.value,
      organization: organization.value,
      role: role.value,
      careerGoal: careerGoal.value,
    },
    descriptions: seedDescriptions.value,
    answers,
    convergence: convergenceSession.value,
  };
  localStorage.setItem(getDraftKey(payload.subject.id), JSON.stringify(payload));
};

const assignDescriptions = (descriptions: IpipPersonaSeedDescriptions) => {
  professionalDescription.value = descriptions.professionalDescription;
  lifeDescription.value = descriptions.lifeDescription;
  instinctNeedsDescription.value = descriptions.instinctNeedsDescription;
  integratedDescription.value = descriptions.integratedDescription;
};

const getSuggestionById = (id: string): PersonaConvergenceSuggestion | null => {
  for (const suggestion of convergenceSession.value.suggestions) {
    if (suggestion.id === id) {
      return suggestion;
    }
  }
  return null;
};

const findAnswerScore = (q: number): LikertScore | null => {
  for (const answer of answers.value) {
    if (answer.q === q) {
      return answer.score;
    }
  }
  return null;
};

const clearViewingSuggestionWhenResolved = (q: number): void => {
  if (!viewingSuggestionId.value) {
    return;
  }
  const suggestion = getSuggestionById(viewingSuggestionId.value);
  if (!suggestion || suggestion.payload.kind !== "questionnaire_answer") {
    viewingSuggestionId.value = "";
    return;
  }
  if (suggestion.payload.q !== q) {
    return;
  }
  viewingSuggestionId.value = "";
};

const dismissPendingSuggestionsForQuestion = (q: number): number => {
  let dismissedCount = 0;
  let session = transitionConvergenceState(convergenceSession.value, "applying");
  for (const suggestion of session.suggestions) {
    if (suggestion.status !== "pending") {
      continue;
    }
    if (suggestion.payload.kind !== "questionnaire_answer") {
      continue;
    }
    if (suggestion.payload.q !== q) {
      continue;
    }
    session = updateSuggestionStatus(session, suggestion.id, "rejected");
    dismissedCount += 1;
  }
  if (dismissedCount === 0) {
    return 0;
  }
  const nextState = countSuggestionsByStatus(session, "pending") > 0 ? "ready" : "done";
  convergenceSession.value = transitionConvergenceState(session, nextState);
  clearViewingSuggestionWhenResolved(q);
  return dismissedCount;
};

const requestFocusQuestion = (q: number): void => {
  focusQuestionQ.value = q;
  focusQuestionRequestId.value += 1;
};

const viewSuggestion = (id: string): void => {
  const suggestion = getSuggestionById(id);
  if (!suggestion || suggestion.payload.kind !== "questionnaire_answer") {
    return;
  }
  if (suggestion.status !== "pending") {
    return;
  }
  viewingSuggestionId.value = id;
  requestFocusQuestion(suggestion.payload.q);
  const currentScore = findAnswerScore(suggestion.payload.q);
  const currentScoreText = currentScore === null ? "未作答" : String(currentScore);
  statusMessage.value = `已定位 Q${suggestion.payload.q}，当前 ${currentScoreText}，建议 ${suggestion.payload.score}。选择任意分值将注销该建议。`;
};

const resetSeedDescriptions = () => {
  professionalDescription.value = "";
  lifeDescription.value = "";
  instinctNeedsDescription.value = "";
  integratedDescription.value = "";
};

const loadDraft = (id: string) => {
  const raw = localStorage.getItem(getDraftKey(id));
  if (!raw) {
    answers.value = [];
    organization.value = "";
    role.value = "";
    careerGoal.value = "";
    resetSeedDescriptions();
    convergenceSession.value = createEmptyConvergenceSession();
    ratingVersion.value += 1;
    return;
  }
  try {
    const draft = JSON.parse(raw) as QuestionnaireDraft;
    subjectName.value = draft.subject.name || subjectName.value;
    subjectType.value = draft.subject.type || subjectType.value;
    organization.value = draft.subject.organization ?? "";
    role.value = draft.subject.role ?? "";
    careerGoal.value = draft.subject.careerGoal ?? "";
    assignDescriptions({
      professionalDescription: draft.descriptions?.professionalDescription ?? "",
      lifeDescription: draft.descriptions?.lifeDescription ?? "",
      instinctNeedsDescription: draft.descriptions?.instinctNeedsDescription ?? "",
      integratedDescription: draft.descriptions?.integratedDescription ?? "",
    });
    answers.value = draft.answers ?? [];
    convergenceSession.value = restoreConvergenceSession(draft.convergence);
    ratingVersion.value += 1;
  } catch {
    answers.value = [];
    organization.value = "";
    role.value = "";
    careerGoal.value = "";
    resetSeedDescriptions();
    convergenceSession.value = createEmptyConvergenceSession();
    ratingVersion.value += 1;
  }
};

const ensurePrivateDir = async (): Promise<void> => {
  const formData = new FormData();
  formData.append("path", "/data/private");
  formData.append("isDir", "true");
  formData.append("modTime", Date.now().toString());
  formData.append("file", "");
  await fetchSyncPost("/api/file/putFile", formData);
};

const resolveNextSampleIndex = async (id: string): Promise<number> => {
  const response = await fetchSyncPost("/api/file/readDir", { path: "/data/private" });
  const files = Array.isArray(response.data) ? response.data : [];
  const pattern = new RegExp(`^${id}_ipip120_sample_(\\d+)\\.json$`);
  let maxIndex = 0;
  for (const file of files) {
    if (!file || typeof file.name !== "string") {
      continue;
    }
    const matched = file.name.match(pattern);
    if (!matched || !matched[1]) {
      continue;
    }
    const currentIndex = Number.parseInt(matched[1], 10);
    if (Number.isFinite(currentIndex) && currentIndex > maxIndex) {
      maxIndex = currentIndex;
    }
  }
  return maxIndex + 1;
};

const writeJsonFile = async (filePath: string, payload: unknown): Promise<void> => {
  const fileName = filePath.split("/").pop() || "payload.json";
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const file = new File([blob], fileName, { lastModified: Date.now() });
  const formData = new FormData();
  formData.append("path", filePath);
  formData.append("isDir", "false");
  formData.append("modTime", Date.now().toString());
  formData.append("file", file);
  await fetchSyncPost("/api/file/putFile", formData);
};

const toProfileSubject = (payload: IpipNeo120SubmissionPayload): IpipSubjectProfile => ({
  id: payload.subject.id,
  name: payload.subject.name,
  organization: payload.subject.organization,
  role: payload.subject.role,
  careerGoal: payload.subject.careerGoal,
});

const saveSubmissionPayload = async (
  payload: IpipNeo120SubmissionPayload,
): Promise<{ samplePath: string; profilePath: string }> => {
  await ensurePrivateDir();
  const safeId = payload.subject.id || "zhi";
  const nextIndex = await resolveNextSampleIndex(safeId);
  const samplePath = `/data/private/${safeId}_ipip120_sample_${nextIndex}.json`;
  const profilePath = `/data/private/${safeId}_persona_profile_${nextIndex}.json`;
  const profile = buildIpipPersonaProfileFromRawAnswers({
    subject: toProfileSubject(payload),
    answers: payload.answers,
    items: questionBank,
  });

  await writeJsonFile(samplePath, payload);
  await writeJsonFile(profilePath, profile);
  return { samplePath, profilePath };
};

const onAnswerUpdated = (answer: { q: number; score: LikertScore }) => {
  const nextAnswers = answers.value.filter((item) => item.q !== answer.q);
  nextAnswers.push(answer);
  answers.value = nextAnswers;
  const dismissedCount = dismissPendingSuggestionsForQuestion(answer.q);
  if (dismissedCount > 0) {
    statusMessage.value = `已作答 Q${answer.q}=${answer.score}，并注销 ${dismissedCount} 条对应建议。`;
  }
  saveDraft(nextAnswers);
};

const hasAnyDescriptionText = (): boolean => {
  if (professionalDescription.value.trim()) {
    return true;
  }
  if (lifeDescription.value.trim()) {
    return true;
  }
  if (instinctNeedsDescription.value.trim()) {
    return true;
  }
  return Boolean(integratedDescription.value.trim());
};

const generateDescriptionToQuestionnaire = async (): Promise<void> => {
  if (isGeneratingDescriptionToQuestionnaire.value) {
    return;
  }
  if (!hasAnyDescriptionText()) {
    statusMessage.value = "请先填写至少一项描述，再生成问卷建议。";
    return;
  }
  isGeneratingDescriptionToQuestionnaire.value = true;
  convergenceSession.value = transitionConvergenceState(convergenceSession.value, "generating");
  statusMessage.value = "正在基于描述生成问卷建议...";
  try {
    const suggestions = await generateDescriptionToQuestionnaireSuggestions({
      subjectId: subjectId.value || "zhi",
      subjectName: subjectName.value || "zhi",
      descriptions: seedDescriptions.value,
      answers: answers.value,
      questionBank: questionBank,
    });
    convergenceSession.value = setConvergenceSuggestions(convergenceSession.value, suggestions);
    const generatedCount = countSuggestionsByStatus(convergenceSession.value, "pending");
    if (generatedCount > 0) {
      statusMessage.value = `已生成 ${generatedCount} 条待确认建议。`;
    }
    if (generatedCount === 0) {
      statusMessage.value = "未生成可用建议，请补充描述后重试。";
    }
    saveDraft(answers.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    convergenceSession.value = transitionConvergenceState(convergenceSession.value, "error", message);
    statusMessage.value = `建议生成失败: ${message}`;
  } finally {
    isGeneratingDescriptionToQuestionnaire.value = false;
  }
};

const nextDecisionState = (): "ready" | "done" => {
  if (pendingSuggestionCount.value > 0) {
    return "ready";
  }
  return "done";
};

const acceptSuggestion = (id: string) => {
  const suggestion = getSuggestionById(id);
  if (!suggestion) {
    return;
  }
  const applyingSession = transitionConvergenceState(convergenceSession.value, "applying");
  convergenceSession.value = updateSuggestionStatus(applyingSession, id, "accepted");
  answers.value = applySuggestionToAnswers(answers.value, suggestion);
  assignDescriptions(applySuggestionToDescriptions(seedDescriptions.value, suggestion));
  if (suggestion.payload.kind === "questionnaire_answer") {
    clearViewingSuggestionWhenResolved(suggestion.payload.q);
  }
  const stateAfterDecision = nextDecisionState();
  convergenceSession.value = transitionConvergenceState(convergenceSession.value, stateAfterDecision);
  statusMessage.value = `已接受建议并应用，描述进度 ${descriptionProgressText.value}，剩余待确认 ${pendingSuggestionCount.value} 条。`;
  saveDraft(answers.value);
};

const rejectSuggestion = (id: string) => {
  const suggestion = getSuggestionById(id);
  if (!suggestion) {
    return;
  }
  const applyingSession = transitionConvergenceState(convergenceSession.value, "applying");
  convergenceSession.value = updateSuggestionStatus(applyingSession, id, "rejected");
  if (suggestion.payload.kind === "questionnaire_answer") {
    clearViewingSuggestionWhenResolved(suggestion.payload.q);
  }
  const stateAfterDecision = nextDecisionState();
  convergenceSession.value = transitionConvergenceState(convergenceSession.value, stateAfterDecision);
  statusMessage.value = `已拒绝建议，描述进度 ${descriptionProgressText.value}，剩余待确认 ${pendingSuggestionCount.value} 条。`;
  saveDraft(answers.value);
};

const collectMissingFields = (): string[] => {
  const checks: Array<{ label: string; value: string }> = [
    { label: "Organization", value: organization.value },
    { label: "Role", value: role.value },
    { label: "Career Goal", value: careerGoal.value },
    { label: "Professional Description", value: professionalDescription.value },
    { label: "Life Description", value: lifeDescription.value },
    { label: "Instinct Needs Description", value: instinctNeedsDescription.value },
    { label: "Integrated Self Description", value: integratedDescription.value },
  ];
  return checks.filter((item) => !item.value.trim()).map((item) => item.label);
};

const onSubmitIpip = async (payload: IpipNeo120SubmissionPayload) => {
  const missingFields = collectMissingFields();
  if (missingFields.length > 0) {
    statusMessage.value = `请先补全字段: ${missingFields.join(" / ")}`;
    return;
  }

  const enrichedPayload: IpipNeo120SubmissionPayload = {
    ...payload,
    subject: subjectMeta.value,
    descriptions: seedDescriptions.value,
  };

  try {
    statusMessage.value = "正在保存问卷与人格档案...";
    const { samplePath, profilePath } = await saveSubmissionPayload(enrichedPayload);
    saveDraft(answers.value);
    statusMessage.value = `问卷已保存: ${samplePath}; 人格档案已保存: ${profilePath}`;
    emit("saved", samplePath);
  } catch (error) {
    statusMessage.value = `保存失败: ${error instanceof Error ? error.message : String(error)}`;
  }
};

watch(subjectId, (value, oldValue) => {
  if (!value || value === oldValue) {
    return;
  }
  loadDraft(value);
});

watch([subjectName, subjectType], () => {
  saveDraft(answers.value);
});
watch(
  [
    organization,
    role,
    careerGoal,
    professionalDescription,
    lifeDescription,
    instinctNeedsDescription,
    integratedDescription,
  ],
  () => {
    saveDraft(answers.value);
  },
);
watch(
  convergenceSession,
  () => {
    saveDraft(answers.value);
  },
  { deep: true },
);

loadDraft(subjectId.value);
</script>
