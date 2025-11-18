<template>
    <SchemaConfigPanel
        v-if=formDescriptionId
        :schema="schema"
        :form-description-id="formDescriptionId"
    />
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import SchemaConfigPanel from '../common/configItems/schemaConfig.panel.vue'

// 获取表单描述ID
const formDescriptionId = ref("")
const schema = shallowRef({})
// 组件挂载时初始化
onMounted(() => {
    import( '../../config/configSchemas/fileTree').then(
        module =>{
            formDescriptionId.value= module.schema.description
            schema.value =module.schema
        }
    )

    // 确保schema已经注册到全局注册表
    // schema文件中的registerItem和registerForm调用会自动处理注册
})
</script>