<template>
  <div class="docs-panel fn__flex-1 fn__flex-column" style="overflow: hidden;">
    <!-- 搜索框 -->
    <div class="b3-form__icon fn__size200" style="margin: 8px;">
      <svg class="b3-form__icon-icon">
        <use xlink:href="#iconSearch"></use>
      </svg>
      <input ref="searchInput" v-model="searchKey" @compositionend="handleCompositionEnd" @input="handleSearchInput"
        placeholder="搜索" class="b3-text-field fn__block b3-form__icon-input" />
    </div>

    <!-- 最近文档列表 -->
    <div class="fn__flex-column fn__flex-1">
      <ul :style="isWindow() ? 'border-left:0;' : ''" class="b3-list b3-list--background">
        <li v-for="(doc, index) in filteredDocs" :key="doc.rootID" :data-index="index" :data-node-id="doc.rootID"
          class="b3-list-item" :class="{ 'b3-list-item--focus': index === 0 }" @click="selectDoc(doc, index)">
          <span
            v-html="unicode2Emoji(doc.icon || siyuanStorage[Constants.LOCAL_IMAGES].file, 'b3-list-item__graphic', true)"></span>
          <span class="b3-list-item__text">{{ doc.title }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { unicode2Emoji } from "../emoji"
import { Constants } from "../constants"
import { isWindow } from "../util/functions"

// 定义 props
const props = defineProps<{
  recentDocs: { rootID: string, icon: string, title: string }[]
}>()

// 定义 emits
const emit = defineEmits<{
  docSelected: [doc: { rootID: string, icon: string, title: string }]
  searchKeyChanged: [key: string]
}>()

// 响应式数据
const searchKey = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

// 获取全局变量
const siyuanStorage = window.siyuan?.storage

// 计算属性
const filteredDocs = computed(() => {
  if (!searchKey.value) return props.recentDocs
  return props.recentDocs.filter(doc =>
    doc.title.toLowerCase().includes(searchKey.value.toLowerCase())
  )
})

// 方法
const selectDoc = (doc: { rootID: string, icon: string, title: string }, index: number) => {
  emit('docSelected', doc)
}

const setSearchKey = (key: string) => {
  searchKey.value = key
  emit('searchKeyChanged', key)
}

const handleSearchInput = (event: InputEvent) => {
  if (event.isComposing) {
    return
  }
  // 搜索逻辑已经通过 v-model 自动处理
  emit('searchKeyChanged', searchKey.value)
}

const handleCompositionEnd = (event: CompositionEvent) => {
  // 搜索逻辑已经通过 v-model 自动处理
  emit('searchKeyChanged', searchKey.value)
}

const focusSearchInput = () => {
  nextTick(() => {
    if (searchInput.value) {
      searchInput.value.focus()
    }
  })
}

// 暴露方法给父组件
defineExpose({
  setSearchKey,
  focusSearchInput
})
</script>