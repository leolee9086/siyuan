<template>
    <div v-if="isReady">
        <!-- 布尔类型配置项 -->
        <CheckBoxItem v-for="(uiDesc, key) in booleanItems" :key="key" :id="key" :label="uiDesc.label"
            :description="uiDesc.description" v-model="configData[key]" @change="handleConfigChange" />

        <!-- 数字类型配置项 -->
        <NumberItem v-for="(uiDesc, key) in numberItems" :key="key" :id="key" :label="uiDesc.label"
            :description="uiDesc.description" :min="getNumberConstraints(key).min" :max="getNumberConstraints(key).max"
            :suffix="getNumberSuffix(key) || ''" :custom-handler="getCustomHandler(key) || undefined"
            v-model="configData[key]" @change="handleConfigChange" />

        <!-- 字符串类型配置项 -->
        <TextItem v-for="(uiDesc, key) in stringItems" :key="key" :id="key" :label="uiDesc.label"
            :description="uiDesc.description" v-model="configData[key]" @change="handleConfigChange" />

        <!-- 下拉选择类型配置项 -->
        <SelectItem v-for="(uiDesc, key) in selectItems" :key="key" :id="key" :label="uiDesc.label"
            :description="uiDesc.description" :options="uiDesc.options" v-model="configData[key]"
            @change="handleConfigChange" />

        <!-- 复合选择器类型配置项 -->
        <CompositeItem v-for="(uiDesc, key) in compositeItems" :key="key" :select-id="uiDesc.selectKey"
            :input-id="uiDesc.inputKey" :label="uiDesc.label" :description="uiDesc.description"
            :select-value="configData[uiDesc.selectKey]" :input-value="configData[uiDesc.inputKey]"
            :options="uiDesc.options" :placeholder-text="uiDesc.placeholderText"
            @update:select-value="updateCompositeValue(uiDesc.selectKey, $event)"
            @update:input-value="updateCompositeValue(uiDesc.inputKey, $event)" @change="handleConfigChange" />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { z, ZodBoolean, ZodNumber, ZodString, ZodObject } from 'zod'
import CheckBoxItem from './checkBoxItem.vue'
import NumberItem from './numberItem.vue'
import TextItem from './textItem.vue'
import SelectItem from './selectItem.vue'
import CompositeItem from './compositeItem.vue'
import { type UIDescription, type UIFormDescription, UIDescriptionSchema, UIFormDescriptionSchema } from '../../../config/configSchemas/utils'
import { siyuanI18n } from '../../../util/siyuanEnvironments/i18n.getI18n'
import { Constants } from '../../../constants'

interface Props {
    schema: ZodObject<any>
}

const props = defineProps<Props>()

// 配置数据
const configData = ref<Record<string, any>>({})
const isReady = ref(false)

// 表单描述缓存
const formDescription = ref<UIFormDescription | null>(null)

// 获取笔记本选项
const getNotebookOptions = () => {
    if (window.siyuan?.notebooks) {
        const helpIds: string[] = []
        Object.keys(Constants.HELP_PATH).forEach((key: string) => {
            const helpId = Constants.HELP_PATH[key]
            if (helpId) {
                helpIds.push(helpId)
            }
        })

        return window.siyuan.notebooks.filter(item => {
            return !helpIds.includes(item.id)
        }).map(item => ({
            value: item.id,
            label: item.name
        }))
    }
    return []
}

// 根据schema解析配置项类型
const booleanItems = computed(() => {
    const items: Record<string, UIDescription> = {}
    Object.entries(props.schema.shape).forEach(([key, zodType]) => {
        if (zodType instanceof ZodBoolean) {
            const uiDesc = zodType.meta()
            if (uiDesc) {
                const validatedDesc = UIDescriptionSchema.safeParse(uiDesc)
                if (validatedDesc.success) {
                    items[key] = validatedDesc.data
                }
            }
        }
    })
    return items
})

const numberItems = computed(() => {
    const items: Record<string, UIDescription> = {}
    Object.entries(props.schema.shape).forEach(([key, zodType]) => {
        if (zodType instanceof ZodNumber) {
            const uiDesc = zodType.meta()
            // 只有当没有 options 时才作为普通数字项处理
            if (uiDesc && !uiDesc.options) {
                const validatedDesc = UIDescriptionSchema.safeParse(uiDesc)
                if (validatedDesc.success) {
                    items[key] = validatedDesc.data
                }
            }
        }
    })
    return items
})

const stringItems = computed(() => {
    const items: Record<string, UIDescription> = {}
    Object.entries(props.schema.shape).forEach(([key, zodType]) => {
        if (zodType instanceof ZodString) {
            const uiDesc = zodType.meta()
            if (uiDesc) {
                const validatedDesc = UIDescriptionSchema.safeParse(uiDesc)
                if (validatedDesc.success) {
                    items[key] = validatedDesc.data
                }
            }
        }
    })
    return items
})

const selectItems = computed(() => {
    const items: Record<string, UIDescription> = {}
    Object.entries(props.schema.shape).forEach(([key, zodType]) => {
        // 目前只支持 ZodNumber 类型的下拉选择（例如 sort）
        if (zodType instanceof ZodNumber) {
            const uiDesc = zodType.meta()
            if (uiDesc && uiDesc.options) {
                const validatedDesc = UIDescriptionSchema.safeParse(uiDesc)
                if (validatedDesc.success) {
                    items[key] = validatedDesc.data
                }
            }
        }
    })
    return items
})

// 复合选择器配置项（特殊处理）
const compositeItems = computed(() => {
    const items: Record<string, any> = {}
    const schemaShape = props.schema.shape

    // 处理 docCreateSave 相关字段
    if (schemaShape.docCreateSaveBox && schemaShape.docCreateSavePath) {
        const boxUiDesc = schemaShape.docCreateSaveBox.meta
        const pathUiDesc = schemaShape.docCreateSavePath.meta
        if (boxUiDesc && pathUiDesc) {
            items['docCreateSave'] = {
                label: pathUiDesc.label || '',
                description: pathUiDesc.description || '',
                selectKey: 'docCreateSaveBox',
                inputKey: 'docCreateSavePath',
                options: getNotebookOptions(),
                placeholderText: siyuanI18n.currentNotebook
            }
        }
    }

    // 处理 refCreateSave 相关字段
    if (schemaShape.refCreateSaveBox && schemaShape.refCreateSavePath) {
        const boxUiDesc = schemaShape.refCreateSaveBox.meta
        const pathUiDesc = schemaShape.refCreateSavePath.meta
        if (boxUiDesc && pathUiDesc) {
            items['refCreateSave'] = {
                label: pathUiDesc.label || '',
                description: pathUiDesc.description || '',
                selectKey: 'refCreateSaveBox',
                inputKey: 'refCreateSavePath',
                options: getNotebookOptions(),
                placeholderText: siyuanI18n.currentNotebook
            }
        }
    }

    return items
})

// 获取数字类型的约束
const getNumberConstraints = (key: string) => {
    const zodType = props.schema.shape[key]
    if (zodType instanceof ZodNumber) {
        const checks = zodType._def.checks || []
        const constraints: { min: number; max: number } = { min: 0, max: 100 }

        checks.forEach((check: any) => {
            if (check.kind === 'min') {
                constraints.min = check.value
            } else if (check.kind === 'max') {
                constraints.max = check.value
            }
        })

        return constraints
    }
    return { min: 0, max: 100 }
}

// 获取数字类型的后缀
const getNumberSuffix = (key: string): string | undefined => {
    // 根据字段名返回相应的后缀
    if (key === 'largeFileWarningSize') {
        return 'MB'
    }
    return undefined
}

// 获取自定义处理函数
const getCustomHandler = (key: string): (() => void) | undefined => {
    // 为 maxOpenTabCount 提供特殊处理
    if (key === 'maxOpenTabCount') {
        return () => {
            // 限制页签最大打开数量为 32
            if (configData.value[key] > 32) {
                configData.value[key] = 32
            }
            if (configData.value[key] < 1) {
                configData.value[key] = 1
            }
            handleConfigChange()
        }
    }
    return undefined
}

// 更新复合选择器的值
const updateCompositeValue = (key: string, value: any) => {
    configData.value[key] = value
}

// 处理配置变更
const handleConfigChange = async () => {
    // 获取表单描述并调用 onchange
    if (formDescription.value?.onchange) {
        await formDescription.value.onchange(configData.value)
    }
}

// 初始化配置数据
const initializeConfig = async () => {
    const meta = props.schema.meta()
    if (meta) {
        const validatedFormDesc = UIFormDescriptionSchema.safeParse(meta)
        if (validatedFormDesc.success) {
            formDescription.value = validatedFormDesc.data
            if (formDescription.value?.initData) {
                const data = await formDescription.value.initData()
                configData.value = data as Record<string, any>
            }
        }
    }
    isReady.value = true
}

// 监听配置数据变化，同步到 model
watch(configData, (newData) => {
    // 同步到各个字段的 model
    Object.entries(booleanItems.value).forEach(([key, uiDesc]) => {
        if (uiDesc.model) {
            uiDesc.model.value = newData[key]
        }
    })

    Object.entries(numberItems.value).forEach(([key, uiDesc]) => {
        if (uiDesc.model) {
            uiDesc.model.value = newData[key]
        }
    })

    Object.entries(stringItems.value).forEach(([key, uiDesc]) => {
        if (uiDesc.model) {
            uiDesc.model.value = newData[key]
        }
    })

    Object.entries(selectItems.value).forEach(([key, uiDesc]) => {
        if (uiDesc.model) {
            uiDesc.model.value = newData[key]
        }
    })

    Object.entries(compositeItems.value).forEach(([_, uiDesc]) => {
        const schemaShape = props.schema.shape
        const boxUiDesc = (schemaShape[uiDesc.selectKey] as any)._def.meta
        const pathUiDesc = (schemaShape[uiDesc.inputKey] as any)._def.meta
        if (boxUiDesc?.model) {
            boxUiDesc.model.value = newData[uiDesc.selectKey]
        }
        if (pathUiDesc?.model) {
            pathUiDesc.model.value = newData[uiDesc.inputKey]
        }
    })
}, { deep: true })

onMounted(() => {
    initializeConfig()
})
</script>
