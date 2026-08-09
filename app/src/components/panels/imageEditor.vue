<template>
  <div class="asset__viewer" @wheel="handleWheel" @mousedown="handleMouseDown" @mousemove="handleMouseMove"
    @mouseup="handleMouseUp" @mouseleave="handleMouseUp">
    <ImageToolbar :scale="scale" :items="toolbarItems" />
    <!-- 去雾参数控制面板 -->
    <div v-if="showDehazePanel" class="asset__dehaze-panel" @mousedown.stop @mousemove.stop>
      <div class="asset__panel-header">
        <span>去雾参数设置</span>
        <button class="b3-button b3-button--outline" @click="toggleDehazePanel">
          <svg>
            <use xlink:href="#iconClose"></use>
          </svg>
        </button>
      </div>
      <div class="asset__panel-content">
        <!-- 基础参数 -->
        <ParameterControl label="去雾强度 (omega)" v-model="params.omega" :min="0.5" :max="1.0" :step="0.05"
          :hint="`控制去雾强度，值越大去雾效果越明显`" />

        <ParameterControl label="最小透射率 (t0)" v-model="params.t0" :min="0.01" :max="1.0" :step="0.01"
          :hint="`控制最小透射率，影响图像亮度`" />

        <ParameterControl label="窗口大小" v-model="params.windowSize" :min="1" :max="31" :step="2"
          :hint="`暗通道计算的窗口大小，影响去雾范围`" :formatValue="(value: number) => `${value}x${value}`" />
        <div class="fn__hr"></div>
        <!-- 自适应模式 -->
        <div class="asset__form-item">
          <label>
            <input type="checkbox" v-model="params.adaptiveMode" />
            自适应模式
          </label>
        </div>

        <div v-if="params.adaptiveMode" class="asset__sub-form">
          <ParameterControl label="自适应强度" v-model="params.adaptiveStrength" :min="0.5" :max="2.0" :step="0.1"
            :hint="getAdaptiveStrengthDescription()" />

          <div class="asset__form-item">
            <label>
              <input type="checkbox" v-model="params.spatialAdaptiveMode" />
              空间自适应模式
            </label>
          </div>
        </div>

        <!-- 图像增强 -->
        <div class="asset__form-item">
          <label>
            <input type="checkbox" v-model="params.enhancementOptions.enableEnhancement" />
            启用增强
          </label>
        </div>

        <div v-if="params.enhancementOptions.enableEnhancement" class="asset__sub-form">
          <ParameterControl label="饱和度增强" v-model="params.enhancementOptions.saturationEnhancement" :min="0.5"
            :max="2.0" :step="0.1" :hint="getSaturationDescription()" />

          <ParameterControl label="对比度增强" v-model="params.enhancementOptions.contrastEnhancement" :min="0.5" :max="2.0"
            :step="0.1" :hint="getContrastDescription()" />

          <ParameterControl label="明度增强" v-model="params.enhancementOptions.brightnessEnhancement" :min="0.5" :max="2.0"
            :step="0.1" :hint="getBrightnessDescription()" />
        </div>
      </div>
    </div>


    <div class="asset__image-wrapper"
      :style="{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`, 'z-index': 0 }"
      ref="imageWrapper">
      <img v-if="!imageLoadError && currentImageSrc" :src="currentImageSrc"
        alt="图片预览" @load="handleImageLoad" @error="handleImageError" ref="imageElement" draggable="false" />
      <div v-else class="asset__image-error" role="alert">
        <span>{{ imageSourceError || "原图加载失败" }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
//本地包,实际文件位于packages\dehaze
//@ts-ignore
import { dehazeImageWebGPUSimple } from "@leolee9086/image-dehazing";
// 导入composable
import { useAutoProcessing } from "../composables/useAutoProcessing";
import { useProcessingParams } from "../composables/useProcessingParams";
import { useImageProcessing } from "../composables/useImageProcessing";
// 导入参数控制组件
import ParameterControl from "../ParameterControl.vue";
// 导入工具栏组件
import ImageToolbar, { type ToolbarItem } from "../imageToolbar.vue";
import { onImageLoadWithCtx } from "./imageEditor.onImageLoad";
import { centerImageWithCtx, resetZoomWithCtx, setScaleWithCtx, zoomInWithCtx, zoomOutWithCtx } from "./imageEditor.zoom";
import { createToolbarItems } from "./imageEditor.toolbarItem";
import { handleWheelWithCtx } from "./imageEditor.wheel";
import { resolveAssetURL } from "../../asset/assetUrl";

// 定义组件属性
interface Props {
  src: string;
}

const props = defineProps<Props>();
// 使用composable
const { isProcessing: autoProcessing, createAutoProcessor, cleanup } = useAutoProcessing();
const {
  params,
  getAdaptiveStrengthDescription,
  getSaturationDescription,
  getContrastDescription,
  getBrightnessDescription,
  getColorBalanceDescription
} = useProcessingParams();
const {
  processedImage,
  isProcessing: imageProcessing,
  setOriginalImage,
  processImageElement,
  originalImage,
  error,
  successMessage,
  processingTime,
  imageStats,
  hazeDetectionResult,
  processingResult,
  statusMessage,
  isCanvasObject,
  resetImage
} = useImageProcessing();

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
const originImageElement = ref<HTMLImageElement>();

// 计算图片源地址
const imageSrc = ref("");
const imageLoadError = ref(false);
const imageSourceError = ref("");

function setImageSource(value: string) {
  imageLoadError.value = false;
  imageSourceError.value = "";
  try {
    if (!value.trim()) {
      throw new Error("原图地址为空");
    }
    imageSrc.value = resolveAssetURL(value);
  } catch (error) {
    imageSrc.value = "";
    imageSourceError.value = error instanceof Error ? error.message : String(error);
    imageLoadError.value = true;
  }
}

setImageSource(props.src);

// 去雾相关状态
const showDehazePanel = ref(false);
const showOriginalImage = ref(false);

watch(() => props.src, value => {
  setImageSource(value);
  resetImage();
  showOriginalImage.value = false;
});


// 计算是否有已处理的图像
const hasDehazedImage = computed(() => processedImage.value !== null);


// 计算当前显示的图片源
const currentImageSrc = computed(() => {
  if (hasDehazedImage.value && processedImage.value) {
    if (showOriginalImage.value) {
      return imageSrc.value;
    }
    // 处理结果只有 Canvas 才能作为处理后图片展示；类型异常必须暴露，不得回到原图伪装成功。
    return processedImage.value.toDataURL();
  }
  return imageSrc.value;
});

const handleImageLoad = () => {
  onImageLoadWithCtx(imageLoadedCtx, centerImage);
};

const handleImageError = () => {
  imageLoadError.value = true;
};
const imageLoadedCtx = {
  imageElement,
  imageWidth,
  imageHeight,
  originImageElement,
  setOriginalImageFn: () => {
    setOriginalImage(originImageElement.value!);
  }
};

// 居中图片
const centerImage = () => {
  const ctx = {
    imageWrapper,
    scale,
    translateX,
    translateY,
    imageWidth,
    imageHeight
  };
  centerImageWithCtx(ctx);
};


// 鼠标滚轮缩放
const handleWheel = (event: WheelEvent) => {
  const ctx = {
    scale,
    imageWrapper,
    translateX,
    translateY,
    setScaleWithCtx,
    zoomInWithCtx,
    zoomOutWithCtx,
  };
  // 调用通用的滚轮处理函数
   handleWheelWithCtx(ctx, event);
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
      imageWrapper.value.style.cursor = "grabbing";
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
    event.preventDefault();
    event.stopPropagation();
  }
};

// 鼠标释放
const handleMouseUp = () => {
  isDragging.value = false;

  // 恢复鼠标样式
  if (imageWrapper.value) {
    imageWrapper.value.style.cursor = "grab";
  }
};

// 窗口大小改变时重新居中
const handleResize = () => {
  centerImage();
};

// 组件挂载
onMounted(() => {
  window.addEventListener("resize", handleResize);

  // 设置初始鼠标样式
  if (imageWrapper.value) {
    imageWrapper.value.style.cursor = "grab";
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



// 创建自动处理函数
const autoProcessFunction = async () => {
  if (!originImageElement.value) {
return;
}
  // 确保每次都从原始图像开始处理，使用originImageElement而不是originalImage.value
  // 因为originImageElement是独立的DOM元素，不会被处理过程修改
  await processImageElement(originImageElement.value, dehazeImageWebGPUSimple, params);
  showOriginalImage.value = false;
};

// 创建防抖的自动处理器
const autoProcessor = createAutoProcessor(autoProcessFunction);

// 监听参数变化，自动触发处理
watch(params, () => {
  if (imageElement.value) {
    autoProcessor();
  }
}, { deep: true });

// 组件卸载时清理
onUnmounted(() => {
  cleanup();
});

// 组件卸载
onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});

// 工具栏配置
const toolbarItems = createToolbarItems({
  scale,
  imageWrapper,
  translateX,
  translateY,
  setScaleWithCtx,
  zoomInWithCtx,
  zoomOutWithCtx,
  resetZoomWithCtx,
  showDehazePanel,
  toggleDehazePanel,
  hasDehazedImage,
  showOriginalImage,
  toggleOriginalImage
});

</script>

<style lang="scss" scoped>
@use "./imageEditor.scss";
</style>
