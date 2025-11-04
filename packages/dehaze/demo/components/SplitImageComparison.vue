<template>
  <div class="split-image-comparison" ref="container">
    <img :src="originalImage" alt="Original Image" class="image original" @load="handleImageLoad" />
    <img :src="processedImage" alt="Processed Image" class="image processed" @load="handleImageLoad" />
    <div class="slider" @mousedown="startDragging" :style="{ left: `${sliderPosition}%` }">
      <div class="slider-line"></div>
      <div class="slider-button"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  originalImage: {
    type: String,
    default: null
  },
  processedImage: {
    type: [String, Object],
    default: null
  }
})

// 响应式状态
const container = ref(null)
const sliderPosition = ref(50)
const isDragging = ref(false)
const imagesLoaded = ref(0)

// 处理图片源的显示
const getImageSource = (image) => {
  if (!image) return ''
  
  if (typeof image === 'string') {
    return image
  } else if (image instanceof HTMLCanvasElement) {
    return image.toDataURL()
  } else if (image instanceof Uint8Array || image instanceof Buffer) {
    const blob = new Blob([image], { type: 'image/jpeg' })
    return URL.createObjectURL(blob)
  } else if (image instanceof Blob) {
    return URL.createObjectURL(image)
  }
  return ''
}

// 修改计算属性
const originalImage = computed(() => {
  return getImageSource(props.originalImage)
})

const processedImage = computed(() => {
  return getImageSource(props.processedImage)
})

// 监听图片变化
watch([originalImage, processedImage], () => {
  // 重置图片加载状态
  imagesLoaded.value = 0
  // 更新处理后图片的裁剪区域
  updateProcessedImageClip()
})

onMounted(() => {
  updateProcessedImageClip()
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDragging)
  document.removeEventListener('mouseup', stopDragging)
  const urls = [originalImage.value, processedImage.value]
  urls.forEach(url => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  })
})

// 处理图片加载
const handleImageLoad = () => {
  imagesLoaded.value += 1
  if (imagesLoaded.value === 2) {
    imagesLoaded.value = 0
  }
}

// 拖动相关方法
const startDragging = (e) => {
  e.preventDefault()
  isDragging.value = true
  document.addEventListener('mousemove', handleDragging)
  document.addEventListener('mouseup', stopDragging)
}

const handleDragging = (e) => {
  if (!isDragging.value || !container.value) return

  const rect = container.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const containerWidth = rect.width

  // 计算百分比位置（限制在0-100之间）
  sliderPosition.value = Math.min(Math.max((x / containerWidth) * 100, 0), 100)

  // 更新压缩图片的显示区域
  updateProcessedImageClip()
}

const stopDragging = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDragging)
  document.removeEventListener('mouseup', stopDragging)
}

// 更新处理后图片的裁剪区域
const updateProcessedImageClip = () => {
  const processedImg = container.value?.querySelector('.processed')
  if (processedImg) {
    processedImg.style.clipPath = `inset(0 0 0 ${sliderPosition.value}%)`
  }
}

// 暴露方法给父组件
defineExpose({
  sliderPosition
})
</script>

<style scoped>
.split-image-comparison {
  position: relative;
  overflow: hidden;
  height: 100%;
  border-radius: 8px;
}

.image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.processed {
  /* 初始裁剪设置会在 JS 中动态更新 */
  clip-path: inset(0 0 0 50%);
}

.slider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40px;
  transform: translateX(-50%);
  cursor: ew-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.slider-line {
  position: absolute;
  width: 2px;
  height: 100%;
  background-color: var(--accent-color, #3b82f6);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}

.slider-button {
  position: absolute;
  width: 40px;
  height: 40px;
  background-color: var(--accent-color, #3b82f6);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  top: 50%;
  transform: translateY(-50%);
  border: 3px solid white;
}

/* 添加一些悬停效果 */
.slider:hover .slider-button {
  transform: translateY(-50%) scale(1.1);
  transition: transform 0.2s ease;
}

.slider:active .slider-button {
  transform: translateY(-50%) scale(0.95);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .slider {
    width: 30px;
  }
  
  .slider-button {
    width: 30px;
    height: 30px;
  }
}
</style> 