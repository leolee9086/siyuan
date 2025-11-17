<template>
    <!-- 复选框配置项 -->
    <label
        v-for="item in checkboxConfigItems"
        :key="item.key"
        class="fn__flex b3-label"
    >
        <div class="fn__flex-1">
            {{ item.title }}
            <div class="b3-label__text">{{ item.description }}</div>
        </div>
        <span class="fn__space"></span>
        <input
            class="b3-switch fn__flex-center"
            :id="item.key"
            type="checkbox"
            v-model="config[item.key]"
            @change="handleConfigChange"
        />
    </label>
    
    <!-- 数字输入框配置项 -->
    <div
        v-for="item in numberConfigItems"
        :key="item.key"
        class="fn__flex b3-label config__item"
    >
        <div class="fn__flex-1">
            {{ item.title }}
            <div class="b3-label__text">{{ item.description }}</div>
        </div>
        <span class="fn__space"></span>
        <div v-if="item.suffix" class="fn__size200 fn__flex-center fn__flex">
            <input
                class="b3-text-field fn__flex-1"
                :id="item.key"
                type="number"
                :min="item.min"
                :max="item.max"
                v-model.number="config[item.key]"
                @change="item.customHandler || handleConfigChange"
            />
            <span class="fn__space"></span>
            <span class="ft__on-surface fn__flex-center">{{ item.suffix }}</span>
        </div>
        <input
            v-else
            class="b3-text-field fn__flex-center fn__size200"
            :id="item.key"
            type="number"
            :min="item.min"
            :max="item.max"
            v-model.number="config[item.key]"
            @change="item.customHandler || handleConfigChange"
        />
    </div>
    
    <!-- 复合选择器配置项 -->
    <div
        v-for="item in compositeConfigItems"
        :key="item.key"
        class="b3-label config__item"
    >
        {{ item.title }}
        <div class="b3-label__text">{{ item.description }}</div>
        <span class="fn__hr"></span>
        <div class="fn__flex">
            <select
                style="min-width: 200px"
                class="b3-select"
                :id="item.selectKey"
                v-model="config[item.selectKey]"
                @change="handleConfigChange"
            >
                <option value="">{{ siyuanI18n.currentNotebook }}</option>
                <option
                    v-for="notebook in notebooks"
                    :key="notebook.id"
                    :value="notebook.id"
                >
                    {{ notebook.name }}
                </option>
            </select>
            <div class="fn__space"></div>
            <input
                class="b3-text-field fn__flex-1"
                :id="item.inputKey"
                v-model="config[item.inputKey]"
                @change="handleConfigChange"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref,  onMounted } from 'vue'
import { fetchPost } from '../../util/fetch'
import { siyuanI18n } from '../../util/siyuanEnvironments/i18n.getI18n'
import { getSiyuanConfig } from '../../util/siyuanEnvironments/getSiyuanConfig'
import { Constants } from '../../constants'

// 定义配置项类型
type CheckboxConfigItem = {
    key: keyof FileTreeConfig
    title: string
    description: string
}

type NumberConfigItem = {
    key: keyof FileTreeConfig
    title: string
    description: string
    min: number
    max: number
    suffix?: string
    customHandler?: () => void
}

type CompositeConfigItem = {
    key: string
    title: string
    description: string
    selectKey: keyof FileTreeConfig
    inputKey: keyof FileTreeConfig
}

// 定义配置接口
interface FileTreeConfig {
    alwaysSelectOpenedFile: boolean
    openFilesUseCurrentTab: boolean
    closeTabsOnStart: boolean
    allowCreateDeeper: boolean
    removeDocWithoutConfirm: boolean
    useSingleLineSave: boolean
    createDocAtTop: boolean
    largeFileWarningSize: number
    maxListCount: number
    maxOpenTabCount: number
    docCreateSaveBox: string
    docCreateSavePath: string
    refCreateSaveBox: string
    refCreateSavePath: string
}

// 复选框配置项数据
const checkboxConfigItems: CheckboxConfigItem[] = [
    {
        key: 'alwaysSelectOpenedFile',
        title: siyuanI18n.selectOpen,
        description: siyuanI18n.fileTree2
    },
    {
        key: 'openFilesUseCurrentTab',
        title: siyuanI18n.fileTree7,
        description: siyuanI18n.fileTree8
    },
    {
        key: 'closeTabsOnStart',
        title: siyuanI18n.fileTree9,
        description: siyuanI18n.fileTree10
    },
    {
        key: 'allowCreateDeeper',
        title: siyuanI18n.fileTree18,
        description: siyuanI18n.fileTree19
    },
    {
        key: 'removeDocWithoutConfirm',
        title: siyuanI18n.fileTree3,
        description: siyuanI18n.fileTree4
    },
    {
        key: 'useSingleLineSave',
        title: siyuanI18n.fileTree20,
        description: siyuanI18n.fileTree21
    },
    {
        key: 'createDocAtTop',
        title: siyuanI18n.fileTree24,
        description: siyuanI18n.fileTree25
    }
]

// 响应式数据
const config = ref<FileTreeConfig>({
    alwaysSelectOpenedFile: false,
    openFilesUseCurrentTab: false,
    closeTabsOnStart: false,
    allowCreateDeeper: false,
    removeDocWithoutConfirm: false,
    useSingleLineSave: false,
    createDocAtTop: false,
    largeFileWarningSize: 10,
    maxListCount: 50,
    maxOpenTabCount: 10,
    docCreateSaveBox: '',
    docCreateSavePath: '',
    refCreateSaveBox: '',
    refCreateSavePath: ''
})

// 响应式数据
const notebooks = ref<Array<{id: string, name: string}>>([])

// 处理最大打开标签页数量变更（需要限制范围）
const handleMaxOpenTabCountChange = () => {
    // 限制页签最大打开数量为 32
    if (config.value.maxOpenTabCount > 32) {
        config.value.maxOpenTabCount = 32
    }
    if (config.value.maxOpenTabCount < 1) {
        config.value.maxOpenTabCount = 1
    }
    saveConfig()
}

// 数字输入框配置项数据
const numberConfigItems: NumberConfigItem[] = [
    {
        key: 'largeFileWarningSize',
        title: siyuanI18n.fileTree22,
        description: siyuanI18n.fileTree23,
        min: 2,
        max: 10240,
        suffix: 'MB'
    },
    {
        key: 'maxListCount',
        title: siyuanI18n.fileTree16,
        description: siyuanI18n.fileTree17,
        min: 1,
        max: 10240
    },
    {
        key: 'maxOpenTabCount',
        title: siyuanI18n.tabLimit,
        description: siyuanI18n.tabLimit1,
        min: 1,
        max: 32,
        customHandler: handleMaxOpenTabCountChange
    }
]

// 复合选择器配置项数据
const compositeConfigItems: CompositeConfigItem[] = [
    {
        key: 'docCreateSave',
        title: siyuanI18n.fileTree12,
        description: siyuanI18n.fileTree13,
        selectKey: 'docCreateSaveBox',
        inputKey: 'docCreateSavePath'
    },
    {
        key: 'refCreateSave',
        title: siyuanI18n.fileTree5,
        description: siyuanI18n.fileTree6,
        selectKey: 'refCreateSaveBox',
        inputKey: 'refCreateSavePath'
    }
]

// 初始化笔记本列表
const initializeNotebooks = () => {
    if (window.siyuan?.notebooks) {
        const helpIds: string[] = []
        Object.keys(Constants.HELP_PATH).forEach((key: string) => {
            const helpId = Constants.HELP_PATH[key ]
            if (helpId) {
                helpIds.push(helpId)
            }
        })
        
        notebooks.value = window.siyuan.notebooks.filter(item => {
            return !helpIds.includes(item.id)
        }).map(item => ({
            id: item.id,
            name: item.name
        }))
    }
}

// 初始化配置
const initializeConfig = () => {
    const siyuanConfig = getSiyuanConfig()
    if (siyuanConfig?.fileTree) {
        config.value = { ...config.value, ...siyuanConfig.fileTree }
    }
}

// 处理配置变更
const handleConfigChange = () => {
    saveConfig()
}


// 保存配置
const saveConfig = () => {
    fetchPost("/api/setting/setFiletree", {
        sort: getSiyuanConfig().fileTree.sort,
        ...config.value
    }, response => {
        getSiyuanConfig().fileTree = response.data
    })
}

// 组件挂载时初始化
onMounted(() => {
    initializeConfig()
    initializeNotebooks()
})
</script>