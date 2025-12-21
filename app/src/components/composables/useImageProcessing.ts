/**
 * 图像处理组合式函数
 * @织: 图像处理相关的响应式逻辑
 */

import { ref, reactive, computed, Ref, UnwrapRef } from "vue";

// 类型定义
interface ImageStats {
  width: number
  height: number
  size: string
}

interface ImageStatsState {
  original: ImageStats
  processed: ImageStats
}

interface EnhancementOptions {
  saturationEnhancement: number
  contrastEnhancement: number
  brightnessEnhancement: number
}

interface AdaptiveOptions {
  omegaAdjustRange: number
  t0AdjustRange: number
  hazeWeight: number
  atmosphericWeight: number
}

interface ProcessingParams {
  windowSize: number
  topRatio: number
  omega: number
  t0: number
  adaptiveMode: boolean
  spatialAdaptiveMode: boolean
  adaptiveStrength: number
  adaptiveOptions: AdaptiveOptions
  enhancementOptions: EnhancementOptions
}

interface ProcessingResult {
  imageData: ImageData
  adaptiveInfo?: any
}


/**
 * 图像处理状态管理
 */
export const useImageProcessing = () => {
  // 响应式状态
  const originalImage: Ref<HTMLImageElement | null> = ref(null);
  const processedImage: Ref<HTMLCanvasElement | null> = ref(null);
  const isProcessing: Ref<boolean> = ref(false);
  const error: Ref<string> = ref("");
  const successMessage: Ref<string> = ref("");
  const processingTime: Ref<number> = ref(0);
  const hazeDetectionResult: Ref<any> = ref(null);
  const processingResult: Ref<ProcessingResult | null> = ref(null);

  const imageStats: UnwrapRef<ImageStatsState> = reactive({
    original: { width: 0, height: 0, size: "0 KB" },
    processed: { width: 0, height: 0, size: "0 KB" }
  });

  // 计算属性
  const statusMessage = computed(() => {
    if (isProcessing.value) {
return "正在处理图像...";
}
    if (!originalImage.value) {
return "请选择图像文件";
}
    return "就绪";
  });

  const isCanvasObject = computed(() => {
    return processedImage.value && processedImage.value instanceof HTMLCanvasElement;
  });

  /**
   * 处理图像元素
   * @param imageElement - 图像元素
   * @param dehazeFunction - 去雾处理函数
   * @param params - 处理参数
   */
  const processImageElement = async (
    imageElement: HTMLImageElement, 
    dehazeFunction: (imageData: ImageData, params: ProcessingParams) => Promise<ProcessingResult>, 
    params: ProcessingParams
  ) => {
    if (!imageElement) {
return;
}

    isProcessing.value = true;
    error.value = "";
    successMessage.value = "";
    const startTime = performance.now();

    try {
      // 创建canvas获取图像数据
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
throw new Error("无法获取Canvas上下文");
}
      
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      ctx.drawImage(imageElement, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // 确保所有参数都是正确的数字类型
      const processedParams: ProcessingParams = {
        ...params,
        windowSize: Number(params.windowSize),
        topRatio: Number(params.topRatio),
        omega: Number(params.omega),
        t0: Number(params.t0),
        adaptiveStrength: Number(params.adaptiveStrength),
        enhancementOptions: {
          ...params.enhancementOptions,
          saturationEnhancement: Number(params.enhancementOptions.saturationEnhancement),
          contrastEnhancement: Number(params.enhancementOptions.contrastEnhancement),
          brightnessEnhancement: Number(params.enhancementOptions.brightnessEnhancement || 1.0)
        }
      };
      
      // 调用去雾函数
      const result = await dehazeFunction(imageData, processedParams);
      
      // 将处理后的图像数据转换为canvas
      const resultCanvas = document.createElement("canvas");
      const resultCtx = resultCanvas.getContext("2d");
      if (!resultCtx) {
throw new Error("无法获取结果Canvas上下文");
}
      
      resultCanvas.width = result.imageData.width;
      resultCanvas.height = result.imageData.height;
      resultCtx.putImageData(result.imageData, 0, 0);
      
      // 保存处理结果和自适应检测结果
      processingResult.value = result;
      hazeDetectionResult.value = result.adaptiveInfo;
      
      // 直接使用canvas对象
      processedImage.value = resultCanvas;
      
      processingTime.value = Math.round(performance.now() - startTime);
      
      successMessage.value = `图像处理完成！耗时 ${processingTime.value}ms`;
      
      imageStats.processed.width = result.imageData.width;
      imageStats.processed.height = result.imageData.height;
      imageStats.processed.size = estimateImageDataSize(result.imageData.width, result.imageData.height);

    } catch (err) {
      error.value = `处理图像时出错: ${(err as Error).message}`;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 设置原始图像
   * @param imageElement - 图像元素
   */
  const setOriginalImage = (imageElement: HTMLImageElement) => {
    originalImage.value = imageElement;
    if (imageElement) {
      imageStats.original.width = imageElement.naturalWidth;
      imageStats.original.height = imageElement.naturalHeight;
    }
  };

  /**
   * 重置图像状态
   */
  const resetImage = () => {
    originalImage.value = null;
    processedImage.value = null;
    error.value = "";
    successMessage.value = "";
    processingTime.value = 0;
    hazeDetectionResult.value = null;
    processingResult.value = null;
    imageStats.original = { width: 0, height: 0, size: "0 KB" };
    imageStats.processed = { width: 0, height: 0, size: "0 KB" };
  };

  return {
    // 状态
    originalImage,
    processedImage,
    isProcessing,
    error,
    successMessage,
    processingTime,
    imageStats,
    hazeDetectionResult,
    processingResult,
    
    // 计算属性
    statusMessage,
    isCanvasObject,
    
    // 方法
    processImageElement,
    setOriginalImage,
    resetImage
  };
};

/**
 * 估算图像数据大小
 * @param width - 图像宽度
 * @param height - 图像高度
 * @returns 格式化后的文件大小字符串
 */
const estimateImageDataSize = (width: number, height: number): string => {
  // RGBA格式，每个像素4字节
  const bytes = width * height * 4;
  if (bytes === 0) {
return "0 Bytes";
}
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};