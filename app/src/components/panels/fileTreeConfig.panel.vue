<template>
    <SchemaConfigPanel v-if="schema" :schema="schema" />
</template>

<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import SchemaConfigPanel from '../common/configItems/schemaConfig.panel.vue'

const schema = shallowRef<any>(null)
// 组件挂载时初始化
onMounted(() => {
    import('../../config/configSchemas/fileTree').then(
        module => {
            schema.value = module.schema
        }
    )
})
</script>