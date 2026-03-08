<template>
  <div class="persona-seed-descriptions">
    <label v-for="item in descriptionItems" :key="item.field">
      <span class="persona-seed-description-head">
        <span>{{ item.label }}</span>
        <button
          type="button"
          class="persona-seed-description-generate"
          :disabled="item.disabled || props.generatingQuestionnaireToDescription"
          @click="emit('generate-questionnaire-to-description', item.field)"
        >
          {{ props.generatingQuestionnaireToDescription ? "生成中..." : "问卷补全此维度" }}
        </button>
      </span>
      <textarea v-model.trim="item.model.value" rows="4" :placeholder="item.placeholder" />
      <small
        v-if="item.field === 'integratedDescription' && !props.canGenerateTrinitySuggestion"
        class="persona-seed-description-hint"
      >
        Trinity 建议需要三侧描述齐备，且问卷进度超过 1/3。
      </small>
    </label>
  </div>
</template>

<script setup lang="ts">
import type { PersonaDescriptionField } from "../../../data/convergence/q2d/persona-seed-convergence-q2d-llm.types";
import type { PersonaSeedDescriptionsFormProps } from "./PersonaSeedDescriptionsForm.types";
import { usePersonaSeedDescriptionsFormContext } from "./PersonaSeedDescriptionsForm.ctx";

const props = defineProps<PersonaSeedDescriptionsFormProps>();

const emit = defineEmits<{
  (e: "generate-questionnaire-to-description", field: PersonaDescriptionField): void;
}>();

const professional = defineModel<string>("professional", { required: true });
const life = defineModel<string>("life", { required: true });
const instinct = defineModel<string>("instinct", { required: true });
const integrated = defineModel<string>("integrated", { required: true });

const { descriptionItems } = usePersonaSeedDescriptionsFormContext(props, {
  professionalDescription: professional,
  lifeDescription: life,
  instinctNeedsDescription: instinct,
  integratedDescription: integrated,
});
</script>
