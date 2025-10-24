<template>
  <div class="fn__flex-column">
  <div class="fn__flex fn__flex-1">
    <div class="fn__flex-column  switch-doc">
      <!-- 左右布局容器 -->
      <div class="fn__flex fn__flex-1" style="overflow: hidden;">
        <!-- 左侧：Dock选择面板 -->
        <DockPanel ref="dockPanelRef" :search-key="searchKey" :switch-path="switchPath"
          @item-selected="handleDockItemSelected" @path-updated="handlePathUpdated" />

        <!-- 右侧：文档选择部分 -->
        <DocsPanel ref="docsPanelRef" :recent-docs="recentDocs" @doc-selected="handleDocSelected"
          @search-key-changed="handleSearchKeyChanged" />
      </div>

    </div>

  </div>
  <!-- 底部路径显示 -->
  <div class="switch-doc__path">{{ switchPath }}</div>
</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { fetchSyncPost } from "../util/fetch"
import { escapeHtml } from "../util/escape"
import { hasClosestByClassName } from "../protyle/util/hasClosest"
import DockPanel from "./panels/dockPanel.vue"
import DocsPanel from "./panels/docsPanel.vue"

// 定义 props
const props = defineProps<{
  recentDocs: { rootID: string, icon: string, title: string }[]
}>()

// 定义 emits
const emit = defineEmits<{
  docSelected: [doc: { rootID: string, icon: string, title: string }]
}>()

// 响应式数据
const searchKey = ref('')
const switchPath = ref('')
const dockPanelRef = ref<InstanceType<typeof DockPanel> | null>(null)
const docsPanelRef = ref<InstanceType<typeof DocsPanel> | null>(null)

// 方法
const handleDocSelected = (doc: { rootID: string, icon: string, title: string }) => {
  emit('docSelected', doc)
  updateSwitchPath(doc.rootID)
}

const handleDockItemSelected = (type: string, index: number) => {
  // Dock项选择处理
}

const handlePathUpdated = (path: string) => {
  switchPath.value = path
}

const handleSearchKeyChanged = (key: string) => {
  searchKey.value = key
}

const updateSwitchPath = async (rootID: string) => {
  const pathResponse = await fetchSyncPost("/api/filetree/getFullHPathByID", {
    id: rootID
  })
  switchPath.value = escapeHtml(pathResponse.data)
}

const setSearchKey = (key: string) => {
  searchKey.value = key
  docsPanelRef.value?.setSearchKey(key)
}

const focusSearchInput = () => {
  docsPanelRef.value?.focusSearchInput()
}

const handleDialogClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const liElement = hasClosestByClassName(target, "b3-list-item")
  if (liElement) {
    // 移除其他项的焦点
    document.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus")
    // 添加当前项的焦点
    liElement.classList.add("b3-list-item--focus")
    // 触发回车事件
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
    event.stopPropagation()
    event.preventDefault()
  }
}

// 初始化
onMounted(() => {
  dockPanelRef.value?.initializeDocks()
  if (props.recentDocs.length > 0) {
    updateSwitchPath(props.recentDocs[0].rootID)
  }

  // 监听对话框点击事件
  document.addEventListener('click', handleDialogClick)

  // 聚焦搜索框
  focusSearchInput()
})

// 组件卸载时清理事件监听
onUnmounted(() => {
  document.removeEventListener('click', handleDialogClick)
})

// 暴露方法给父组件
defineExpose({
  setSearchKey,
  focusSearchInput
})
</script>