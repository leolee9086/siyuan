<template>
  <div class="image-preview">
    <!-- 拖拽上传区域 -->
    <div 
      v-if="!originalImage"
      class="upload-area"
      :class="{ dragover: isDragOver }"
      @drop="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @click="triggerFileInput"
    >
      <div class="upload-content">
        <div class="upload-icon">📷</div>
        <h3>拖拽图片到此处或点击选择</h3>
        <p>支持 JPG、PNG、WebP 等格式</p>
      </div>
    </div>

    <!-- 裂像对比显示区域 -->
    <div v-else class="split-comparison-container">
      <SplitImageComparison
        :original-image="originalImage"
        :processed-image="processedImageUrl"
      />
    </div>

    <!-- 隐藏的文件输入框 -->
    <input 
      ref="fileInput" 
      type="file" 
      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp" 
      @change="handleFileSelect"
      style="display: none"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SplitImageComparison from './SplitImageComparison.vue'

const props = defineProps({
  originalImage: {
    type: String,
    default: null
  },
  processedImage: {
    type: [String, Object],
    default: null
  },
  imageName: {
    type: String,
    default: ''
  },
  isDragOver: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'file-select',
  'drop',
  'drag-over',
  'drag-leave',
  'trigger-file-input'
])

const fileInput = ref(null)

// 处理processedImage，转换为可显示的URL
const processedImageUrl = computed(() => {
  if (!props.processedImage) return null
  
  if (typeof props.processedImage === 'string') {
    return props.processedImage
  } else if (props.processedImage instanceof HTMLCanvasElement) {
    return props.processedImage.toDataURL()
  } else if (props.processedImage instanceof Uint8Array || props.processedImage instanceof Buffer) {
    const blob = new Blob([props.processedImage], { type: 'image/jpeg' })
    return URL.createObjectURL(blob)
  } else if (props.processedImage instanceof Blob) {
    return URL.createObjectURL(props.processedImage)
  }
  return null
})

// 事件处理函数
const handleFileSelect = (event) => {
  emit('file-select', event)
}

const handleDrop = (event) => {
  emit('drop', event)
}

const handleDragOver = (event) => {
  emit('drag-over', event)
}

const handleDragLeave = () => {
  emit('drag-leave')
}

const triggerFileInput = () => {
  emit('trigger-file-input')
}

// 暴露方法给父组件
defineExpose({
  fileInput
})
</script>

<style scoped>
.image-preview {
  width: 100%;
  height: 100%;
}

.upload-area {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
  cursor: pointer;
}

.upload-area:hover {
  border-color: var(--accent-color);
  background: var(--bg-hover);
}

.upload-area.dragover {
  border-color: var(--accent-color);
  background: var(--bg-hover);
  transform: scale(1.02);
}

.upload-content {
  text-align: center;
  color: var(--text-secondary);
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.upload-content h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.upload-content p {
  margin: 0;
  font-size: 0.9rem;
}

.split-comparison-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style> 