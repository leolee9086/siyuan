<template>
    <div>
        <!-- 布尔类型配置项 -->
        <CheckBoxItem
            v-for="(uiDesc, key) in booleanItems"
            :key="key"
            :id="key"
            :label="uiDesc.label"
            :description="uiDesc.description"
            v-model="configData[key]"
            @change="handleConfigChange"
        />
        
        <!-- 数字类型配置项 -->
        <NumberItem
            v-for="(uiDesc, key) in numberItems"
            :key="key"
            :id="key"
            :label="uiDesc.label"
            :description="uiDesc.description"
            :min="getNumberConstraints(key).min"
            :max="getNumberConstraints(key).max"
            :suffix="getNumberSuffix(key)||''"
            :custom-handler="getCustomHandler(key)"
            v-model="configData[key]"
            @change="handleConfigChange"
        />
        
        <!-- 字符串类型配置项 -->
        <TextItem
            v-for="(uiDesc, key) in stringItems"
            :key="key"
            :id="key"
            :label="uiDesc.label"
            :description="uiDesc.description"
            v-model="configData[key]"
            @change="handleConfigChange"
        />
        
        <!-- 复合选择器类型配置项 -->
        <CompositeItem
            v-for="(uiDesc, key) in compositeItems"
            :key="key"
            :select-id="uiDesc.selectKey"
            :input-id="uiDesc.inputKey"
            :label="uiDesc.label"
            :description="uiDesc.description"
            :select-value="configData[uiDesc.selectKey]"
            :input-value="configData[uiDesc.inputKey]"
            :options="uiDesc.options"
            :placeholder-text="uiDesc.placeholderText"
            @update:select-value="updateCompositeValue(uiDesc.selectKey, $event)"
            @update:input-value="updateCompositeValue(uiDesc.inputKey, $event)"
            @change="handleConfigChange"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { z, ZodBoolean, ZodNumber, ZodString, ZodObject } from 'zod'
import CheckBoxItem from './checkBoxItem.vue'
import NumberItem from './numberItem.vue'
import TextItem from './textItem.vue'
import CompositeItem from './compositeItem.vue'
import { uiDescriptionRegistry, type UIDescription, type UIFormDescription } from '../../../config/configSchemas/utils'
import { siyuanI18n } from '../../../util/siyuanEnvironments/i18n.getI18n'
import { Constants } from '../../../constants'

interface Props {
    schema: ZodObject<any>
    formDescriptionId?: string
}

const props = defineProps<Props>()

// 配置数据
const configData = ref<Record<string, any>>({})

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
            const description = zodType.description
            const uiDesc = uiDescriptionRegistry.get(description)
            if (uiDesc) {
                items[key] = uiDesc
            }
        }
    })
    return items
})

const numberItems = computed(() => {
    const items: Record<string, UIDescription> = {}
    Object.entries(props.schema.shape).forEach(([key, zodType]) => {
        if (zodType instanceof ZodNumber) {
            const description = zodType.description
            const uiDesc = uiDescriptionRegistry.get(description)
            if (uiDesc) {
                items[key] = uiDesc
            }
        }
    })
    return items
})

const stringItems = computed(() => {
    const items: Record<string, UIDescription> = {}
    Object.entries(props.schema.shape).forEach(([key, zodType]) => {
        if (zodType instanceof ZodString) {
            const description = zodType.description
            const uiDesc = uiDescriptionRegistry.get(description)
            if (uiDesc) {
                items[key] = uiDesc
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
        const boxDescription = schemaShape.docCreateSaveBox.description
        const pathDescription = schemaShape.docCreateSavePath.description
        const boxUiDesc = uiDescriptionRegistry.get(boxDescription)
        const pathUiDesc = uiDescriptionRegistry.get(pathDescription)
        if (boxUiDesc && pathUiDesc) {
            items['docCreateSave'] = {
                label: pathUiDesc.label,
                description: pathUiDesc.description,
                selectKey: 'docCreateSaveBox',
                inputKey: 'docCreateSavePath',
                options: getNotebookOptions(),
                placeholderText: siyuanI18n.currentNotebook
            }
        }
    }
    
    // 处理 refCreateSave 相关字段
    if (schemaShape.refCreateSaveBox && schemaShape.refCreateSavePath) {
        const boxDescription = schemaShape.refCreateSaveBox.description
        const pathDescription = schemaShape.refCreateSavePath.description
        const boxUiDesc = uiDescriptionRegistry.get(boxDescription)
        const pathUiDesc = uiDescriptionRegistry.get(pathDescription)
        if (boxUiDesc && pathUiDesc) {
            items['refCreateSave'] = {
                label: pathUiDesc.label,
                description: pathUiDesc.description,
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
const handleConfigChange = () => {
    // 获取表单描述并调用 onchange
    if (formDescription.value?.onchange) {
        formDescription.value.onchange(configData.value)
    }
}

// 初始化配置数据
const initializeConfig = async () => {
    console.log(props.formDescriptionId)
    if (props.formDescriptionId) {
        // 从全局注册表中获取表单描述
        const registry = uiDescriptionRegistry.formRegistry
        if (registry && registry.has(props.formDescriptionId)) {
            formDescription.value = registry.get(props.formDescriptionId)
            console.log(formDescription.value)
            if (formDescription.value?.initData) {
                const data = await formDescription.value.initData()
                            console.log(data)

                configData.value = { ...data }
                
            }
        }
    }
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
    
    Object.entries(compositeItems.value).forEach(([_, uiDesc]) => {
        const schemaShape = props.schema.shape
        const boxDescription = schemaShape[uiDesc.selectKey].description
        const pathDescription = schemaShape[uiDesc.inputKey].description
        const boxUiDesc = uiDescriptionRegistry.get(boxDescription)
        const pathUiDesc = uiDescriptionRegistry.get(pathDescription)
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