<template>
  <div class="asset__viewer" @wheel="handleWheel" @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp">
    <div class="asset__toolbar">
      <button class="b3-button b3-button--outline" @click="zoomOut">
        <svg><use xlink:href="#iconMinus"></use></svg>
      </button>
      <span class="asset__zoom-level">{{ Math.round(scale * 100) }}%</span>
      <button class="b3-button b3-button--outline" @click="zoomIn">
        <svg><use xlink:href="#iconAdd"></use></svg>
      </button>
      <div class="fn__space"></div>
      <button class="b3-button b3-button--outline" @click="resetZoom">
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </button>
      <div class="fn__space"></div>
      <button
        class="b3-button b3-button--outline"
        @click="toggleDehazePanel"
        :class="{ 'is-active': showDehazePanel }"
        title="去雾处理"
      >
        <svg><use xlink:href="#iconSun"></use></svg>
      </button>
      <button
        v-if="hasDehazedImage"
        class="b3-button b3-button--outline"
        @click="toggleOriginalImage"
        :class="{ 'is-active': !showOriginalImage }"
        title="切换原图/去雾图"
      >
        <svg><use xlink:href="#iconCompare"></use></svg>
      </button>
    </div>
    <!-- 去雾参数控制面板 -->
    <div v-if="showDehazePanel" class="asset__dehaze-panel" @mousedown.stop @mousemove.stop>
      <div class="asset__panel-header">
        <span>去雾参数设置</span>
        <button class="b3-button b3-button--outline" @click="toggleDehazePanel">
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="asset__panel-content">
        <div class="asset__form-item">
          <label>去雾强度 (omega)</label>
          <input
            type="range"
            min="0.5"
            max="1.0"
            step="0.05"
            v-model="dehazeParams.omega"
          />
          <span>{{ dehazeParams.omega }}</span>
        </div>
        <div class="asset__form-item">
          <label>最小透射率 (t0)</label>
          <input
            type="range"
            min="0.01"
            max="0.3"
            step="0.01"
            v-model="dehazeParams.t0"
          />
          <span>{{ dehazeParams.t0 }}</span>
        </div>
        <div class="asset__form-item">
          <label>窗口大小</label>
          <select v-model="dehazeParams.windowSize">
            <option value="7">7x7</option>
            <option value="15">15x15</option>
            <option value="21">21x21</option>
            <option value="31">31x31</option>
          </select>
        </div>
        <div class="asset__form-item">
          <label>
            <input type="checkbox" v-model="dehazeParams.adaptiveMode" />
            自适应模式
          </label>
        </div>
        <div class="asset__form-item">
          <label>
            <input type="checkbox" v-model="dehazeParams.spatialAdaptiveMode" />
            空间自适应模式
          </label>
        </div>
        <div class="asset__form-item">
          <label>
            <input type="checkbox" v-model="dehazeParams.enhancementOptions.enableEnhancement" />
            启用增强
          </label>
        </div>
        <div v-if="dehazeParams.enhancementOptions.enableEnhancement" class="asset__sub-form">
          <div class="asset__form-item">
            <label>饱和度增强</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              v-model="dehazeParams.enhancementOptions.saturationEnhancement"
            />
            <span>{{ dehazeParams.enhancementOptions.saturationEnhancement }}</span>
          </div>
          <div class="asset__form-item">
            <label>对比度增强</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              v-model="dehazeParams.enhancementOptions.contrastEnhancement"
            />
            <span>{{ dehazeParams.enhancementOptions.contrastEnhancement }}</span>
          </div>
        </div>
        <div class="asset__panel-actions">
          <button
            class="b3-button b3-button--primary"
            @click="applyDehaze"
            :disabled="isProcessing"
          >
            {{ isProcessing ? '处理中...' : '应用去雾' }}
          </button>
          <button
            v-if="hasDehazedImage"
            class="b3-button b3-button--outline"
            @click="resetToOriginal"
          >
            重置为原图
          </button>
        </div>
      </div>
    </div>
    
    <!-- 处理进度提示 -->
    <div v-if="isProcessing" class="asset__processing-overlay">
      <div class="asset__processing-content">
        <div class="asset__spinner"></div>
        <span>正在处理图像，请稍候...</span>
      </div>
    </div>
    
    <div
      class="asset__image-wrapper"
      :style="{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})` }"
      ref="imageWrapper"
    >
      <img
        :src="currentImageSrc"
        @load="onImageLoad"
        ref="imageElement"
        draggable="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
//本地包,实际文件位于packages\dehaze
//@ts-ignore
import {dehazeImageWebGPUSimple} from '@leolee9086/image-dehazing'

// 定义组件属性
interface Props {
  src: string;
}

const props = defineProps<Props>();

// 缩放和平移状态
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragStartTranslateX = ref(0);
const dragStartTranslateY = ref(0);

// 图片原始尺寸
const imageWidth = ref(0);
const imageHeight = ref(0);

// DOM引用
const imageWrapper = ref<HTMLDivElement>();
const imageElement = ref<HTMLImageElement>();

// 计算图片源地址
const imageSrc = ref(props.src.startsWith("file") ? props.src : document.getElementById("baseURL")?.getAttribute("href") + "/" + props.src);

// 去雾相关状态
const showDehazePanel = ref(false);
const isProcessing = ref(false);
const hasDehazedImage = ref(false);
const showOriginalImage = ref(false);
const dehazedImageDataUrl = ref('');
const originalImageDataUrl = ref('');

// 去雾参数
const dehazeParams = ref({
  windowSize: 15,
  topRatio: 0.1,
  omega: 0.95,
  t0: 0.1,
  adaptiveMode: false,
  spatialAdaptiveMode: false,
  adaptiveStrength: 1.0,
  adaptiveOptions: {},
  enhancementOptions: {
    enableEnhancement: false,
    saturationEnhancement: 1.2,
    contrastEnhancement: 1.1
  }
});

// 计算当前显示的图片源
const currentImageSrc = computed(() => {
  if (hasDehazedImage.value) {
    return showOriginalImage.value ? originalImageDataUrl.value : dehazedImageDataUrl.value;
  }
  return imageSrc.value;
});

// 缩放步长
const ZOOM_STEP = 0.1;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

// 图片加载完成
const onImageLoad = () => {
  if (imageElement.value) {
    imageWidth.value = imageElement.value.naturalWidth;
    imageHeight.value = imageElement.value.naturalHeight;
    
    // 保存原始图片数据URL，用于去雾处理
    if (!hasDehazedImage.value && imageSrc.value) {
      originalImageDataUrl.value = imageSrc.value;
    }
    
    centerImage();
  }
};

// 居中图片
const centerImage = () => {
  if (imageWrapper.value && imageWrapper.value.parentElement) {
    const containerWidth = imageWrapper.value.parentElement.clientWidth;
    const containerHeight = imageWrapper.value.parentElement.clientHeight;
    
    // 计算居中位置
    translateX.value = (containerWidth - imageWidth.value * scale.value) / 2;
    translateY.value = (containerHeight - imageHeight.value * scale.value) / 2;
  }
};

// 放大
const zoomIn = () => {
  const newScale = Math.min(scale.value + ZOOM_STEP, MAX_SCALE);
  setScale(newScale);
};

// 缩小
const zoomOut = () => {
  const newScale = Math.max(scale.value - ZOOM_STEP, MIN_SCALE);
  setScale(newScale);
};

// 重置缩放
const resetZoom = () => {
  setScale(1);
};

// 设置缩放并保持中心点
const setScale = (newScale: number) => {
  if (imageWrapper.value && imageWrapper.value.parentElement) {
    const containerWidth = imageWrapper.value.parentElement.clientWidth;
    const containerHeight = imageWrapper.value.parentElement.clientHeight;
    
    // 计算当前中心点
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    // 计算缩放前中心点在图片坐标系中的位置
    const imageCenterX = (centerX - translateX.value) / scale.value;
    const imageCenterY = (centerY - translateY.value) / scale.value;
    
    // 更新缩放
    scale.value = newScale;
    
    // 计算新的平移量，保持中心点不变
    translateX.value = centerX - imageCenterX * newScale;
    translateY.value = centerY - imageCenterY * newScale;
  }
};

// 鼠标滚轮缩放
const handleWheel = (event: WheelEvent) => {
  event.preventDefault();
  
  if (event.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
};

// 鼠标按下
const handleMouseDown = (event: MouseEvent) => {
  if (event.button === 0) { // 左键
    isDragging.value = true;
    dragStartX.value = event.clientX;
    dragStartY.value = event.clientY;
    dragStartTranslateX.value = translateX.value;
    dragStartTranslateY.value = translateY.value;
    
    // 改变鼠标样式
    if (imageWrapper.value) {
      imageWrapper.value.style.cursor = 'grabbing';
    }
  }
};

// 鼠标移动
const handleMouseMove = (event: MouseEvent) => {
  if (isDragging.value) {
    const deltaX = event.clientX - dragStartX.value;
    const deltaY = event.clientY - dragStartY.value;
    
    translateX.value = dragStartTranslateX.value + deltaX;
    translateY.value = dragStartTranslateY.value + deltaY;
    event.preventDefault()
    event.stopPropagation()
  }
};

// 鼠标释放
const handleMouseUp = () => {
  isDragging.value = false;
  
  // 恢复鼠标样式
  if (imageWrapper.value) {
    imageWrapper.value.style.cursor = 'grab';
  }
};

// 窗口大小改变时重新居中
const handleResize = () => {
  centerImage();
};

// 组件挂载
onMounted(() => {
  window.addEventListener('resize', handleResize);
  
  // 设置初始鼠标样式
  if (imageWrapper.value) {
    imageWrapper.value.style.cursor = 'grab';
  }
});

// 切换去雾面板显示
const toggleDehazePanel = () => {
  showDehazePanel.value = !showDehazePanel.value;
};

// 切换原图/去雾图显示
const toggleOriginalImage = () => {
  if (hasDehazedImage.value) {
    showOriginalImage.value = !showOriginalImage.value;
  }
};

// 应用去雾处理
const applyDehaze = async () => {
  if (!imageElement.value || isProcessing.value) return;
  
  isProcessing.value = true;
  
  try {
    // 创建canvas获取图像数据
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取Canvas上下文');
    
    canvas.width = imageWidth.value;
    canvas.height = imageHeight.value;
    ctx.drawImage(imageElement.value, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 确保所有参数都是正确的数字类型
    const processedParams = {
      ...dehazeParams.value,
      windowSize: Number(dehazeParams.value.windowSize),
      topRatio: Number(dehazeParams.value.topRatio),
      omega: Number(dehazeParams.value.omega),
      t0: Number(dehazeParams.value.t0),
      adaptiveStrength: Number(dehazeParams.value.adaptiveStrength),
      enhancementOptions: {
        ...dehazeParams.value.enhancementOptions,
        saturationEnhancement: Number(dehazeParams.value.enhancementOptions.saturationEnhancement),
        contrastEnhancement: Number(dehazeParams.value.enhancementOptions.contrastEnhancement)
      }
    };
    
    // 调用去雾函数
    const result = await dehazeImageWebGPUSimple(imageData, processedParams);
    
    // 将处理后的图像数据转换为URL
    const resultCanvas = document.createElement('canvas');
    const resultCtx = resultCanvas.getContext('2d');
    if (!resultCtx) throw new Error('无法获取结果Canvas上下文');
    
    resultCanvas.width = imageWidth.value;
    resultCanvas.height = imageHeight.value;
    resultCtx.putImageData(result.imageData, 0, 0);
    
    dehazedImageDataUrl.value = resultCanvas.toDataURL();
    hasDehazedImage.value = true;
    showOriginalImage.value = false;
    
    console.log('去雾处理完成:', result);
  } catch (error) {
    console.error('去雾处理失败:', error);
    alert('去雾处理失败: ' + (error as Error).message);
  } finally {
    isProcessing.value = false;
  }
};

// 重置为原图
const resetToOriginal = () => {
  hasDehazedImage.value = false;
  showOriginalImage.value = false;
  dehazedImageDataUrl.value = '';
};

// 组件卸载
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style lang="scss" scoped>
.asset__viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
}

.asset__toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  background-color: var(--b3-theme-background);
  border-radius: 4px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
  
  .is-active {
    background-color: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
  }
}

.asset__zoom-level {
  font-size: 12px;
  color: var(--b3-theme-on-background);
  min-width: 40px;
  text-align: center;
}

.asset__dehaze-panel {
  position: absolute;
  top: 60px;
  right: 10px;
  width: 300px;
  max-height: 70vh;
  background-color: var(--b3-theme-background);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
  overflow-y: auto;
}

.asset__panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--b3-theme-surface-light);
  font-weight: bold;
}

.asset__panel-content {
  padding: 12px;
}

.asset__form-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  
  label {
    flex: 1;
    margin-right: 8px;
    font-size: 12px;
  }
  
  input[type="range"] {
    flex: 2;
    margin-right: 8px;
  }
  
  input[type="checkbox"] {
    margin-right: 8px;
  }
  
  select {
    flex: 2;
    padding: 2px 4px;
  }
  
  span {
    min-width: 40px;
    text-align: right;
    font-size: 12px;
  }
}

.asset__sub-form {
  margin-left: 20px;
  padding-left: 8px;
  border-left: 2px solid var(--b3-theme-surface-light);
}

.asset__panel-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
}

.asset__processing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20;
}

.asset__processing-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--b3-theme-background);
  padding: 20px;
  border-radius: 8px;
  color: var(--b3-theme-on-background);
}

.asset__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--b3-theme-surface-light);
  border-top: 3px solid var(--b3-theme-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.asset__image-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
  transition: transform 0.1s ease-out;
}

.asset__image-wrapper img {
  max-width: none;
  max-height: none;
  display: block;
}

</style>