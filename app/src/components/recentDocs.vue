<template>
  <div class="fn__flex-column switch-doc">
    <div class="fn__flex-column fn__flex-1" style="overflow:auto;">
      <!-- 搜索框 -->
      <div class="b3-form__icon fn__size200" style="margin: 8px;">
        <svg class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
        <input
          ref="searchInput"
          v-model="searchKey"
          @compositionend="handleCompositionEnd"
          @input="handleSearchInput"
          placeholder="搜索"
          class="b3-text-field fn__block b3-form__icon-input"
        />
      </div>
      <div class="fn__flex fn__flex-1">
      <div v-if="!isWindow()" class="b3-list b3-list--background" style="overflow: auto;width: 200px;">
        <li 
          v-if="!searchKey || siyuanLanguages.riffCard.toLowerCase().includes(searchKey.toLowerCase())"
          data-type="riffCard" 
          data-index="0" 
          class="b3-list-item"
          :class="{ 'b3-list-item--focus': !switchPath }"
          @click="selectItem('riffCard', 0)"
        >
          <svg class="b3-list-item__graphic"><use xlink:href="#iconRiffCard"></use></svg>
          <span class="b3-list-item__text">{{ siyuanLanguages.riffCard }}</span>
          <span class="b3-list-item__meta">{{ updateHotkeyTip(siyuanConfig.keymap.general.riffCard.custom) }}</span>
        </li>
        <li 
          v-for="(dock, index) in filteredDocks" 
          :key="dock.type"
          :data-type="dock.type" 
          :data-index="index + 1" 
          class="b3-list-item"
          :class="{ 'b3-list-item--focus': !switchPath && selectedDockIndex === index + 1 }"
          @click="selectItem(dock.type, index + 1)"
        >
          <svg class="b3-list-item__graphic"><use :xlink:href="`#${dock.icon}`"></use></svg>
          <span class="b3-list-item__text">{{ dock.title }}</span>
          <span class="b3-list-item__meta">{{ updateHotkeyTip(dock.hotkey || '') }}</span>
        </li>
      </div>
      <ul :style="isWindow() ? 'border-left:0;' : ''" class="b3-list b3-list--background fn__flex-1">
        <li 
          v-for="(doc, index) in filteredDocs" 
          :key="doc.rootID"
          :data-index="index" 
          :data-node-id="doc.rootID" 
          class="b3-list-item"
          :class="{ 'b3-list-item--focus': index === 0 }"
          @click="selectDoc(doc, index)"
        >
          <span v-html="unicode2Emoji(doc.icon || siyuanStorage[Constants.LOCAL_IMAGES].file, 'b3-list-item__graphic', true)"></span>
          <span class="b3-list-item__text">{{ doc.title }}</span>
        </li>
      </ul>
      </div>
    </div>
    <div class="switch-doc__path">{{ switchPath }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { fetchPost, fetchSyncPost } from "../util/fetch"
import { unicode2Emoji } from "../emoji"
import { Constants } from "../constants"
import { escapeHtml } from "../util/escape"
import { isWindow } from "../util/functions"
import { updateHotkeyTip } from "../protyle/util/compatibility"
import { getAllDocks } from "../layout/getAll"
import { hasClosestByClassName } from "../protyle/util/hasClosest"

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
const selectedDockIndex = ref(0)
const docks = ref<{ type: string, title: string, icon: string, hotkey: string }[]>([])
const searchInput = ref<HTMLInputElement | null>(null)

// 获取全局变量
const siyuanLanguages = window.siyuan?.languages 
const siyuanConfig = window.siyuan?.config 
const siyuanStorage = window.siyuan?.storage 

// 计算属性
const filteredDocs = computed(() => {
  if (!searchKey.value) return props.recentDocs
  return props.recentDocs.filter(doc => 
    doc.title.toLowerCase().includes(searchKey.value.toLowerCase())
  )
})

const filteredDocks = computed(() => {
  if (!searchKey.value) return docks.value
  return docks.value.filter(dock => 
    dock.title.toLowerCase().includes(searchKey.value.toLowerCase())
  )
})

// 方法
const selectDoc = (doc: { rootID: string, icon: string, title: string }, index: number) => {
  emit('docSelected', doc)
  updateSwitchPath(doc.rootID)
}

const selectItem = (type: string, index: number) => {
  selectedDockIndex.value = index
  if (type === 'riffCard') {
    switchPath.value = siyuanLanguages.riffCard
  }
}

const updateSwitchPath = async (rootID: string) => {
  const pathResponse = await fetchSyncPost("/api/filetree/getFullHPathByID", {
    id: rootID
  })
  switchPath.value = escapeHtml(pathResponse.data)
}

const setSearchKey = (key: string) => {
  searchKey.value = key
}

const handleSearchInput = (event: InputEvent) => {
  if (event.isComposing) {
    return
  }
  // 搜索逻辑已经通过 v-model 自动处理
}

const handleCompositionEnd = (event: CompositionEvent) => {
  // 搜索逻辑已经通过 v-model 自动处理
}

const focusSearchInput = () => {
  nextTick(() => {
    if (searchInput.value) {
      searchInput.value.focus()
    }
  })
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
    window.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter"}))
    event.stopPropagation()
    event.preventDefault()
  }
}

// 初始化
onMounted(() => {
  if (!isWindow()) {
    docks.value = getAllDocks().map(dock => ({
      type: dock.type,
      title: dock.title || '',
      icon: dock.icon,
      hotkey: dock.hotkey || ''
    }))
  }
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