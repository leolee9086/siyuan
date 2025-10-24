<template>
  <div v-if="!isWindow()" class="dock-panel b3-list b3-list--background"
    style="min-width: 200px; max-width: 280px; flex-shrink: 0;">
    <li v-if="!searchKey || siyuanLanguages.riffCard.toLowerCase().includes(searchKey.toLowerCase())"
      data-type="riffCard" data-index="0" class="b3-list-item" :class="{ 'b3-list-item--focus': !switchPath && selectedDockIndex === 0 }"
      @click="selectItem('riffCard', 0)">
      <svg class="b3-list-item__graphic">
        <use xlink:href="#iconRiffCard"></use>
      </svg>
      <span class="b3-list-item__text">{{ siyuanLanguages.riffCard }}</span>
      <span class="b3-list-item__meta">{{ updateHotkeyTip(siyuanConfig.keymap.general.riffCard.custom) }}</span>
    </li>
    <li v-for="(dock, index) in filteredDocks" :key="dock.type" :data-type="dock.type" :data-index="index + 1"
      class="b3-list-item" :class="{ 'b3-list-item--focus': !switchPath && selectedDockIndex === index + 1 }"
      @click="selectItem(dock.type, index + 1)">
      <svg class="b3-list-item__graphic">
        <use :xlink:href="`#${dock.icon}`"></use>
      </svg>
      <span class="b3-list-item__text">{{ dock.title }}</span>
      <span class="b3-list-item__meta">{{ updateHotkeyTip(dock.hotkey || '') }}</span>
    </li>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { isWindow } from "../util/functions"
import { updateHotkeyTip } from "../protyle/util/compatibility"
import { getAllDocks } from "../layout/getAll"

// 定义 props
const props = defineProps<{
  searchKey: string
  switchPath: string
}>()

// 定义 emits
const emit = defineEmits<{
  itemSelected: [type: string, index: number]
  pathUpdated: [path: string]
}>()

// 响应式数据
const selectedDockIndex = ref(0)
const docks = ref<{ type: string, title: string, icon: string, hotkey: string }[]>([])

// 获取全局变量
const siyuanLanguages = window.siyuan?.languages
const siyuanConfig = window.siyuan?.config

// 计算属性
const filteredDocks = computed(() => {
  // 搜索时不包含dock栏，直接返回所有dock
  return docks.value
})

// 方法
const selectItem = (type: string, index: number) => {
  selectedDockIndex.value = index
  if (type === 'riffCard') {
    emit('pathUpdated', siyuanLanguages.riffCard)
  }
  emit('itemSelected', type, index)
}

// 初始化
const initializeDocks = () => {
  if (!isWindow()) {
    docks.value = getAllDocks().map(dock => ({
      type: dock.type,
      title: dock.title || '',
      icon: dock.icon,
      hotkey: dock.hotkey || ''
    }))
  }
}

// 暴露方法给父组件
defineExpose({
  initializeDocks
})
</script>