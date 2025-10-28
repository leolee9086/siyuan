<template>
  <div class="b3-dialog__content">
    <slot name="content"></slot>
  </div>
  <div class="b3-dialog__action">
    <slot name="actions"></slot>
  </div>
</template>

<script setup lang="ts">
// 这是一个纯布局组件，不需要业务逻辑
</script>