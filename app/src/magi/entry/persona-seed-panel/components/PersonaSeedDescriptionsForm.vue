<template>
  <div class="persona-seed-descriptions">
    <label>
      Professional Description (Melchior)
      <textarea
        v-model.trim="professional"
        rows="4"
        placeholder="职业场景中的能力定位、判断标准、长期职业发展方向。"
      />
    </label>
    <label>
      Life Description (Balthazar)
      <textarea
        v-model.trim="life"
        rows="4"
        placeholder="日常生活中的关系偏好、情绪模式、价值取舍。"
      />
    </label>
    <label>
      Instinct Needs Description (Casper)
      <textarea
        v-model.trim="instinct"
        rows="4"
        placeholder="自身核心需求、边界底线、即时驱动。"
      />
    </label>
    <label>
      Integrated Self Description (Trinity)
      <textarea
        v-model.trim="integrated"
        rows="4"
        placeholder="统一自我叙述，聚焦'我是谁、我想成为什么样的人'。"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
const professional = defineModel<string>("professional", { required: true });
const life = defineModel<string>("life", { required: true });
const instinct = defineModel<string>("instinct", { required: true });
const integrated = defineModel<string>("integrated", { required: true });
</script>
