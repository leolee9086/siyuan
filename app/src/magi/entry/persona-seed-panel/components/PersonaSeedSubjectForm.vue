<template>
  <div class="persona-seed-subject">
    <label>
      Subject ID
      <input :value="subjectId" type="text" @input="$emit('update:subjectId', ($event.target as HTMLInputElement).value.trim())" />
    </label>
    <label>
      Name
      <input :value="subjectName" type="text" @input="$emit('update:subjectName', ($event.target as HTMLInputElement).value.trim())" />
    </label>
    <label>
      Gender
      <input :value="gender" type="text" @input="$emit('update:gender', ($event.target as HTMLInputElement).value.trim())" />
    </label>
    <label>
      Age
      <input
        :value="age ?? ''"
        type="number"
        @input="$emit('update:age', ($event.target as HTMLInputElement).value === '' ? null : (Number.parseInt(($event.target as HTMLInputElement).value, 10) || 0))"
      />
    </label>
    <label>
      Type
      <select :value="subjectType" @change="$emit('update:subjectType', ($event.target as HTMLSelectElement).value)">
        <option value="human">human</option>
        <option value="ai_agent">ai_agent</option>
      </select>
    </label>
    <label>
      Organization
      <input :value="organization" type="text" @input="$emit('update:organization', ($event.target as HTMLInputElement).value.trim())" />
    </label>
    <label>
      Role
      <input :value="role" type="text" @input="$emit('update:role', ($event.target as HTMLInputElement).value.trim())" />
    </label>
    <label>
      Career Goal
      <input :value="careerGoal" type="text" @input="$emit('update:careerGoal', ($event.target as HTMLInputElement).value.trim())" />
    </label>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  subjectId: string;
  subjectName: string;
  gender: string;
  age: number | null;
  subjectType: string;
  organization: string;
  role: string;
  careerGoal: string;
}>();

defineEmits<{
  (e: "update:subjectId", v: string): void;
  (e: "update:subjectName", v: string): void;
  (e: "update:gender", v: string): void;
  (e: "update:age", v: number | null): void;
  (e: "update:subjectType", v: string): void;
  (e: "update:organization", v: string): void;
  (e: "update:role", v: string): void;
  (e: "update:careerGoal", v: string): void;
}>();
</script>
