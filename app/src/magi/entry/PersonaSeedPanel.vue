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
      </div>

      <Suspense>
        <template #default>
          <CompositeRating
            :key="ratingKey"
            :question-bank="questionBank"
            :subject="subjectMeta"
            @update:ipip-answer="onAnswerUpdated"
            @submit:ipip="onSubmitIpip"
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
import { computed, ref, watch } from "vue";
import { fetchSyncPost } from "../../util/network/fetch";
import { ipipNeo120QuestionBank } from "../data/ipip-neo-120";
import type {
    IpipNeo120SubmissionPayload,
    IpipNeo120SubjectMeta,
} from "../data/questionnaire.types";
import type { LikertScore } from "../components/persona/CompositeRating.types";
import CompositeRating from "../components/persona/CompositeRating.vue";
import "./PersonaSeedPanel.css";

type SubjectType = "human" | "ai_agent";

interface QuestionnaireDraft {
    subject: {
        id: string;
        name: string;
        type: SubjectType;
    };
    answers: Array<{ q: number; score: LikertScore }>;
}

const emit = defineEmits<{
    (e: "close"): void;
    (e: "saved", filePath: string): void;
}>();

const questionBank = ipipNeo120QuestionBank;

const subjectId = ref("rei");
const subjectName = ref("rei");
const subjectType = ref<SubjectType>("ai_agent");
const answers = ref<Array<{ q: number; score: LikertScore }>>([]);
const ratingVersion = ref(0);
const statusMessage = ref("");

const ratingKey = computed(() => `${subjectId.value}-${ratingVersion.value}`);
const subjectMeta = computed<IpipNeo120SubjectMeta>(() => ({
    id: subjectId.value || "rei",
    name: subjectName.value || "rei",
    type: subjectType.value,
}));

const getDraftKey = (id: string): string => `magi_questionnaire_draft_${id || "rei"}`;

const saveDraft = (answers: Array<{ q: number; score: LikertScore }>) => {
    const payload: QuestionnaireDraft = {
        subject: {
            id: subjectId.value || "rei",
            name: subjectName.value || "rei",
            type: subjectType.value,
        },
        answers,
    };
    localStorage.setItem(getDraftKey(payload.subject.id), JSON.stringify(payload));
};

const loadDraft = (id: string) => {
    const raw = localStorage.getItem(getDraftKey(id));
    if (!raw) {
        answers.value = [];
        ratingVersion.value += 1;
        return;
    }
    try {
        const draft = JSON.parse(raw) as QuestionnaireDraft;
        subjectName.value = draft.subject.name || subjectName.value;
        subjectType.value = draft.subject.type || subjectType.value;
        answers.value = draft.answers ?? [];
        ratingVersion.value += 1;
    } catch {
        answers.value = [];
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

const saveSubmissionPayload = async (payload: IpipNeo120SubmissionPayload): Promise<string> => {
    await ensurePrivateDir();
    const safeId = payload.subject.id || "rei";
    const nextIndex = await resolveNextSampleIndex(safeId);
    const fileName = `${safeId}_ipip120_sample_${nextIndex}.json`;
    const filePath = `/data/private/${fileName}`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const file = new File([blob], fileName, { lastModified: Date.now() });

    const formData = new FormData();
    formData.append("path", filePath);
    formData.append("isDir", "false");
    formData.append("modTime", Date.now().toString());
    formData.append("file", file);

    await fetchSyncPost("/api/file/putFile", formData);
    return filePath;
};

const onAnswerUpdated = (answer: { q: number; score: LikertScore }) => {
    const nextAnswers = answers.value.filter((item) => item.q !== answer.q);
    nextAnswers.push(answer);
    answers.value = nextAnswers;
    saveDraft(nextAnswers);
};

const onSubmitIpip = async (payload: IpipNeo120SubmissionPayload) => {
    try {
        statusMessage.value = "正在保存问卷...";
        const filePath = await saveSubmissionPayload(payload);
        saveDraft(answers.value);
        statusMessage.value = `问卷已保存: ${filePath}`;
        emit("saved", filePath);
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

loadDraft(subjectId.value);
</script>
