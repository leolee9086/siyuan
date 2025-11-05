<template>
  <div class="app">
    <!-- 顶部工具栏 -->
    <header class="toolbar">
      <div class="toolbar-left">
        <h1 class="app-title">WebGPU图像去雾工具</h1>
      </div>
      <div class="toolbar-center">
        <button 
          class="toolbar-btn"
          @click="triggerFileInputWrapper"
          :disabled="isProcessing"
        >
          <span class="icon">📁</span>
          打开图片
        </button>

        <button 
          class="toolbar-btn"
          @click="resetImage"
          :disabled="!selectedImage || isProcessing"
        >
          <span class="icon">🔄</span>
          重置
        </button>
      </div>
      <div class="toolbar-right">
        <div class="status">
          {{ statusMessage }}
        </div>
      </div>
    </header>

    <!-- 主界面 -->
    <div class="main-content">
      <!-- 左侧面板 - 工具和参数 -->
      <aside class="sidebar">
        <div class="panel">
          <h3 class="panel-title">WebGPU去雾参数</h3>
          
          <!-- 自适应模式开关 -->
          <div class="checkbox-control">
            <div class="checkbox-header">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="params.adaptiveMode"
                  :disabled="isProcessing"
                  class="checkbox-input"
                />
                全局自适应模式
              </label>
            </div>
            <div class="checkbox-hint" v-if="params.adaptiveMode">
              根据整体雾强度自动调整参数
            </div>
          </div>
          
          <!-- 空间自适应模式开关 -->
          <div class="checkbox-control">
            <div class="checkbox-header">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="params.spatialAdaptiveMode"
                  :disabled="isProcessing"
                  class="checkbox-input"
                />
                空间自适应模式
              </label>
            </div>
            <div class="checkbox-hint" v-if="params.spatialAdaptiveMode">
              根据每个位置的雾强度分布调整参数
            </div>
          </div>
          
          <!-- 自适应调整强度 -->
          <ParameterControl
            v-if="params.adaptiveMode || params.spatialAdaptiveMode"
            v-model="params.adaptiveStrength"
            label="自适应调整强度"
            :min="0.5"
            :max="2.0"
            :step="0.1"
            :disabled="isProcessing"
            :hint="getAdaptiveStrengthDescription()"
          />
          
          <!-- 基础参数控制 -->
          <ParameterControl
            v-for="param in basicParams"
            :key="param.key"
            :model-value="param.value"
            @update:model-value="(value) => updateBasicParam(param.key, value)"
            :label="param.label"
            :min="param.min"
            :max="param.max"
            :step="param.step"
            :disabled="isProcessing"
            :hint="param.hint"
          />
        </div>

        <!-- 图像增强选项 -->
        <div class="panel">
          <h3 class="panel-title">图像增强选项</h3>
          
          <!-- 增强功能开关 -->
          <div class="checkbox-control">
            <div class="checkbox-header">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="params.enhancementOptions.enableEnhancement"
                  :disabled="isProcessing"
                  class="checkbox-input"
                />
                启用饱和度和对比度增强
              </label>
            </div>
            <div class="checkbox-hint" v-if="params.enhancementOptions.enableEnhancement">
              对去雾后的图像进行饱和度和对比度增强
            </div>
          </div>
          
          <!-- 增强参数控制 -->
          <ParameterControl
            v-if="params.enhancementOptions.enableEnhancement"
            v-for="param in enhancementParams"
            :key="param.key"
            :model-value="param.value"
            @update:model-value="(value) => updateEnhancementParam(param.key, value)"
            :label="param.label"
            :min="param.min"
            :max="param.max"
            :step="param.step"
            :disabled="isProcessing"
            :hint="param.hint"
          />
        </div>

        <!-- 自适应参数高级设置 -->
        <div v-if="params.adaptiveMode || params.spatialAdaptiveMode" class="panel">
          <h3 class="panel-title">自适应参数高级设置</h3>
          
          <ParameterControl
            v-for="param in adaptiveParams"
            :key="param.key"
            :model-value="param.value"
            @update:model-value="(value) => updateAdaptiveParam(param.key, value)"
            :label="param.label"
            :min="param.min"
            :max="param.max"
            :step="param.step"
            :disabled="isProcessing"
            :hint="param.hint"
          />
        </div>
        
        <!-- 雾强度检测结果 -->
        <div v-if="hazeDetectionResult" class="panel">
          <h3 class="panel-title">雾强度检测</h3>
          <div class="haze-info">
            <div class="haze-description">{{ hazeDetectionResult.description }}</div>
            <div class="haze-stats">
              <div class="stat-item">
                <span class="stat-label">雾强度等级:</span>
                <span class="stat-value">{{ Math.round(hazeDetectionResult.hazeLevel * 100) }}%</span>
              </div>
              <div class="stat-item" v-if="processingResult && !processingResult.spatialAdaptiveMode">
                <span class="stat-label">自适应ω:</span>
                <span class="stat-value">{{ hazeDetectionResult.omega.toFixed(3) }}</span>
              </div>
              <div class="stat-item" v-if="processingResult && processingResult.spatialAdaptiveMode">
                <span class="stat-label">空间自适应:</span>
                <span class="stat-value">已启用</span>
              </div>
              <div class="stat-item" v-if="hazeDetectionResult.adaptiveFactor !== undefined">
                <span class="stat-label">原始因子:</span>
                <span class="stat-value">{{ (hazeDetectionResult.adaptiveFactor * 100).toFixed(1) }}%</span>
              </div>
              <div class="stat-item" v-if="hazeDetectionResult.adjustedAdaptiveFactor !== undefined">
                <span class="stat-label">调整后因子:</span>
                <span class="stat-value">{{ (hazeDetectionResult.adjustedAdaptiveFactor * 100).toFixed(1) }}%</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">大气光值:</span>
                <span class="stat-value">{{ (hazeDetectionResult.stats.atmosphericLight * 255).toFixed(0) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">对比度比率:</span>
                <span class="stat-value">{{ (hazeDetectionResult.stats.contrastRatio * 100).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- RGB大气光检测结果 -->
        <div v-if="processingResult && processingResult.atmosphericLight" class="panel">
          <h3 class="panel-title">RGB大气光检测</h3>
          <div class="atmospheric-light-info">
            <div class="stat-item">
              <span class="stat-label">红色通道:</span>
              <span class="stat-value">{{ (processingResult.atmosphericLight.r * 255).toFixed(0) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">绿色通道:</span>
              <span class="stat-value">{{ (processingResult.atmosphericLight.g * 255).toFixed(0) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">蓝色通道:</span>
              <span class="stat-value">{{ (processingResult.atmosphericLight.b * 255).toFixed(0) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">亮度通道:</span>
              <span class="stat-value">{{ (processingResult.atmosphericLight.luminance * 255).toFixed(0) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">色彩平衡:</span>
              <span class="stat-value">{{ getColorBalanceDescription(processingResult.atmosphericLight) }}</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title">图像信息</h3>
          <div class="info-item" v-if="imageStats.original.width">
            <span class="info-label">尺寸:</span>
            <span class="info-value">{{ imageStats.original.width }} × {{ imageStats.original.height }}</span>
          </div>
          <div class="info-item" v-if="imageStats.original.size">
            <span class="info-label">大小:</span>
            <span class="info-value">{{ imageStats.original.size }}</span>
          </div>
          <div class="info-item" v-if="processingTime">
            <span class="info-label">处理时间:</span>
            <span class="info-value">{{ processingTime }}ms</span>
          </div>
        </div>
      </aside>

      <!-- 中央主视图 -->
      <main class="main-view">
        <ImagePreview
          :original-image="originalImage"
          :processed-image="processedImage"
          :image-name="selectedImage?.name"
          :is-drag-over="isDragOver"
          @file-select="handleFileSelect"
          @drop="handleDrop"
          @drag-over="handleDragOver"
          @drag-leave="handleDragLeave"
          @trigger-file-input="triggerFileInputWrapper"
          ref="imagePreviewRef"
        />
      </main>
    </div>

    <!-- 消息提示 -->
    <div v-if="error" class="message error">
      <span class="message-icon">❌</span>
      {{ error }}
    </div>
    <div v-if="showSuccessMessage" class="message success">
      <span class="message-icon">✅</span>
      {{ successMessageText }}
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed, onUnmounted, watch } from 'vue'
import { useImageProcessing } from './composables/useImageProcessing.js'
import { useProcessingParams } from './composables/useProcessingParams.js'
import { useAutoProcessing } from './composables/useAutoProcessing.js'
import { useFileUpload } from './composables/useFileUpload.js'
import ParameterControl from './components/ParameterControl.vue'
import ImagePreview from './components/ImagePreview.vue'
// 添加自动消失的successMessage管理
const showSuccessMessage = ref(false)
const successMessageText = ref('')

// 使用组合式函数
const {
  selectedImage,
  originalImage,
  processedImage,
  isProcessing: imageProcessing,
  error,
  successMessage,
  processingTime,
  imageStats,
  hazeDetectionResult,
  processingResult,
  statusMessage,
  isCanvasObject,
  handleImageFile,
  processImage,
  resetImage
} = useImageProcessing()

// 监听successMessage变化，实现自动消失
watch(successMessage, (newMessage) => {
  if (newMessage) {
    successMessageText.value = newMessage
    showSuccessMessage.value = true
    
    // 2.7秒后开始淡出动画
    setTimeout(() => {
      const messageElement = document.querySelector('.message.success')
      if (messageElement) {
        messageElement.classList.add('fade-out')
      }
    }, 2700)
    
    // 3秒后完全隐藏
    setTimeout(() => {
      showSuccessMessage.value = false
    }, 3000)
  }
})

// 初始化参数管理
const {
  params,
  getAdaptiveStrengthDescription,
  getSaturationDescription,
  getContrastDescription,
  getBrightnessDescription,
  getColorBalanceDescription
} = useProcessingParams()

// 创建自动处理逻辑
const { isProcessing, createAutoProcessor, cleanup } = useAutoProcessing()

// 创建处理函数
const processWithParams = async () => {
  if (!selectedImage.value) return
  
  await processImage({
    windowSize: params.windowSize,
    topRatio: params.topRatio,
    omega: params.omega,
    t0: params.t0,
    adaptiveMode: params.adaptiveMode,
    spatialAdaptiveMode: params.spatialAdaptiveMode,
    adaptiveStrength: params.adaptiveStrength,
    adaptiveOptions: params.adaptiveOptions,
    enhancementOptions: params.enhancementOptions
  })
}

// 创建自动处理器
const autoProcessor = createAutoProcessor(processWithParams)

// 监听参数变化，自动触发处理
watch(
  () => [
    params.omega,
    params.t0,
    params.windowSize,
    params.topRatio,
    params.adaptiveMode,
    params.spatialAdaptiveMode,
    params.adaptiveStrength
  ],
  () => {
    if (selectedImage.value) {
      autoProcessor()
    }
  },
  { deep: true }
)

// 监听自适应选项变化
watch(
  () => params.adaptiveOptions,
  () => {
    if (selectedImage.value) {
      autoProcessor()
    }
  },
  { deep: true }
)

// 监听增强选项变化
watch(
  () => params.enhancementOptions,
  () => {
    if (selectedImage.value) {
      autoProcessor()
    }
  },
  { deep: true }
)



// 定义参数控制组件的参数
const basicParams = computed(() => [
  { 
    key: 'omega', 
    label: '去雾强度', 
    min: 0.0, 
    max: 1, 
    step: 0.01, 
    hint: '控制去雾的强度',
    value: params.omega
  },
  { 
    key: 't0', 
    label: '雾浓度参考值', 
    min: 0.05, 
    max: 1.1, 
    step: 0.01, 
    hint: '预设雾浓度阈值，防止过度去雾',
    value: params.t0
  },
  { 
    key: 'windowSize', 
    label: '暗通道窗口大小', 
    min: 1, 
    max: 31, 
    step: 2, 
    hint: '暗通道计算的窗口大小，影响细节保留',
    value: params.windowSize
  },
  { 
    key: 'topRatio', 
    label: '大气光估计比例', 
    min: 0.01, 
    max: 0.5, 
    step: 0.01, 
    hint: '用于估计大气光的像素比例',
    value: params.topRatio
  }
])

const enhancementParams = computed(() => [
  { 
    key: 'saturationEnhancement', 
    label: '饱和度增强', 
    min: 0.0, 
    max: 2.0, 
    step: 0.1, 
    hint: getSaturationDescription(),
    value: params.enhancementOptions.saturationEnhancement
  },
  { 
    key: 'contrastEnhancement', 
    label: '对比度增强', 
    min: 0.5, 
    max: 2.0, 
    step: 0.1, 
    hint: getContrastDescription(),
    value: params.enhancementOptions.contrastEnhancement
  },
  { 
    key: 'brightnessEnhancement', 
    label: '明度增强', 
    min: 0.5, 
    max: 2.0, 
    step: 0.1, 
    hint: getBrightnessDescription(),
    value: params.enhancementOptions.brightnessEnhancement
  }
])

const adaptiveParams = computed(() => [
  { 
    key: 'omegaAdjustRange', 
    label: 'Omega调整范围', 
    min: 0.05, 
    max: 0.5, 
    step: 0.01, 
    hint: '自适应模式下omega的调整范围',
    value: params.adaptiveOptions.omegaAdjustRange
  },
  { 
    key: 't0AdjustRange', 
    label: 'T0调整范围', 
    min: 0.01, 
    max: 0.2, 
    step: 0.01, 
    hint: '自适应模式下t0的调整范围',
    value: params.adaptiveOptions.t0AdjustRange
  },
  { 
    key: 'hazeWeight', 
    label: '雾强度权重', 
    min: 0.1, 
    max: 0.9, 
    step: 0.1, 
    hint: '雾强度在自适应计算中的权重',
    value: params.adaptiveOptions.hazeWeight
  },
  { 
    key: 'atmosphericWeight', 
    label: '大气光权重', 
    min: 0.1, 
    max: 0.9, 
    step: 0.1, 
    hint: '大气光在自适应计算中的权重',
    value: params.adaptiveOptions.atmosphericWeight
  }
])

// 错误处理包装器
const handleFileUpload = (file) => {
  try {
    handleImageFile(file)
  } catch (err) {
    error.value = err.message
  }
}

// 参数更新函数 - 直接更新params，自动触发处理
const updateBasicParam = (key, value) => {
  params[key] = value
}

const updateEnhancementParam = (key, value) => {
  params.enhancementOptions[key] = value
}

const updateAdaptiveParam = (key, value) => {
  params.adaptiveOptions[key] = value
}

const {
  isDragOver,
  handleFileSelect,
  handleDrop,
  handleDragOver,
  handleDragLeave
} = useFileUpload(handleFileUpload)

// 更新triggerFileInput函数，使用ImagePreview组件的fileInput
const triggerFileInputWrapper = () => {
  if (imagePreviewRef.value) {
    imagePreviewRef.value.fileInput.click()
  }
}
const imagePreviewRef = ref(null)

// 组件卸载时清理
onUnmounted(() => {
  cleanup()
})


</script>

<style >
@import url('./style.css');
/* Checkbox控制样式 - 紧凑版本 */
.checkbox-control {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: #3c3c3c;
  border-radius: 4px;
  border: 1px solid #4a4a4a;
}

.checkbox-header {
  margin-bottom: 0.4rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  font-weight: 500;
  color: #e0e0e0;
  font-size: 0.8rem;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  width: 14px;
  height: 14px;
  margin-right: 0.4rem;
  accent-color: #0078d4;
  cursor: pointer;
  transition: all 0.2s ease;
}

.checkbox-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-input:focus {
  outline: 2px solid #0078d4;
  outline-offset: 2px;
}

.checkbox-hint {
  font-size: 0.7rem;
  color: #888888;
  line-height: 1.3;
  margin-top: 0.2rem;
  padding-left: 1.2rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .checkbox-control {
    padding: 0.4rem;
  }
  
  .checkbox-label {
    font-size: 0.75rem;
  }
  
  .checkbox-input {
    width: 16px;
    height: 16px;
  }
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .checkbox-input {
    border-width: 2px;
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .checkbox-input {
    transition: none;
  }
}
</style> 