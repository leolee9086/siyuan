<template>
  <div class="fn__flex-column switch-doc">
    <div class="fn__flex fn__flex-1" style="overflow:auto;">
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
    <div class="switch-doc__path">{{ switchPath }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchPost, fetchSyncPost } from "../util/fetch"
import { unicode2Emoji } from "../emoji"
import { Constants } from "../constants"
import { escapeHtml } from "../util/escape"
import { isWindow } from "../util/functions"
import { updateHotkeyTip } from "../protyle/util/compatibility"
import { getAllDocks } from "../layout/getAll"

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

// 获取全局变量
const siyuanLanguages = (window as any).siyuan?.languages || {}
const siyuanConfig = (window as any).siyuan?.config || {}
const siyuanStorage = (window as any).siyuan?.storage || {}

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
})

// 暴露方法给父组件
defineExpose({
  setSearchKey
})
</script>