/**
 * 图像处理组合式函数
 * @织: 图像处理相关的响应式逻辑
 */

import { ref, reactive, computed } from 'vue'
import { dehazeImageWebGPUSimple } from '../../src/core/dehazing-webgpu.js'
import { loadImage, estimateImageDataSize } from '../utils/imageUtils.js'

/**
 * 图像处理状态管理
 */
export const useImageProcessing = () => {
  // 响应式状态
  const selectedImage = ref(null)
  const originalImage = ref(null)
  const processedImage = ref(null)
  const isProcessing = ref(false)
  const error = ref('')
  const successMessage = ref('')
  const processingTime = ref(0)
  const hazeDetectionResult = ref(null)
  const processingResult = ref(null)

  const imageStats = reactive({
    original: { width: 0, height: 0, size: '0 KB' },
    processed: { width: 0, height: 0, size: '0 KB' }
  })

  // 计算属性
  const statusMessage = computed(() => {
    if (isProcessing.value) return '正在处理图像...'
    if (!selectedImage.value) return '请选择图像文件'
    return '就绪'
  })

  const isCanvasObject = computed(() => {
    return processedImage.value && processedImage.value instanceof HTMLCanvasElement
  })

  /**
   * 处理图像文件
   * @param {File} file - 图像文件
   */
  const handleImageFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      selectedImage.value = file
      originalImage.value = e.target.result
      processedImage.value = null
      error.value = ''
      successMessage.value = ''
      processingTime.value = 0
      
      // 立即设置文件大小
      imageStats.original.size = formatFileSize(file.size)
      
      // 获取图片尺寸
      const img = new Image()
      img.onload = () => {
        imageStats.original.width = img.width
        imageStats.original.height = img.height
      }
      img.onerror = () => {
        error.value = '图片加载失败'
      }
      img.src = e.target.result
    }
    reader.onerror = () => {
      error.value = '文件读取失败'
    }
    reader.readAsDataURL(file)
  }

  /**
   * 执行图像去雾处理
   * @param {Object} params - 处理参数
   */
  const processImage = async (params) => {
    if (!selectedImage.value) return

    isProcessing.value = true
    error.value = ''
    successMessage.value = ''
    const startTime = performance.now()

    try {
      // 图像加载阶段
      const imageLoadStart = performance.now()
      const img = await loadImage(originalImage.value)
      const imageLoadTime = performance.now() - imageLoadStart
      console.log(`图像加载耗时: ${imageLoadTime.toFixed(2)}ms`)

      // Canvas准备阶段
      const canvasPrepStart = performance.now()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const canvasPrepTime = performance.now() - canvasPrepStart
      console.log(`Canvas准备耗时: ${canvasPrepTime.toFixed(2)}ms`)
      
      // WebGPU处理阶段
      const webgpuStart = performance.now()
      const result = await dehazeImageWebGPUSimple(imageData, params)
      const webgpuTime = performance.now() - webgpuStart
      console.log(`WebGPU处理耗时: ${webgpuTime.toFixed(2)}ms`)

      // 结果转换阶段
      const resultConvStart = performance.now()
      const outputCanvas = document.createElement('canvas')
      const outputCtx = outputCanvas.getContext('2d')
      outputCanvas.width = result.imageData.width
      outputCanvas.height = result.imageData.height
      outputCtx.putImageData(result.imageData, 0, 0)
      
      // 保存处理结果和自适应检测结果
      processingResult.value = result
      hazeDetectionResult.value = result.adaptiveInfo
      
      // 直接使用canvas对象，不转换为DataURL
      processedImage.value = outputCanvas
      const resultConvTime = performance.now() - resultConvStart
      console.log(`结果转换耗时: ${resultConvTime.toFixed(2)}ms`)
      
      processingTime.value = Math.round(performance.now() - startTime)
      
      successMessage.value = `图像处理完成！耗时 ${processingTime.value}ms`
      
      imageStats.processed.width = result.imageData.width
      imageStats.processed.height = result.imageData.height
      imageStats.processed.size = estimateImageDataSize(result.imageData.width, result.imageData.height)

      // 输出详细耗时分析
      console.log('=== 详细耗时分析 ===')
      console.log(`图像加载: ${imageLoadTime.toFixed(2)}ms`)
      console.log(`Canvas准备: ${canvasPrepTime.toFixed(2)}ms`)
      console.log(`WebGPU处理: ${webgpuTime.toFixed(2)}ms`)
      console.log(`结果转换: ${resultConvTime.toFixed(2)}ms`)
      console.log(`总耗时: ${processingTime.value}ms`)
      console.log(`WebGPU占比: ${((webgpuTime / processingTime.value) * 100).toFixed(1)}%`)

    } catch (err) {
      error.value = `处理图像时出错: ${err.message}`
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * 重置图像状态
   */
  const resetImage = () => {
    selectedImage.value = null
    originalImage.value = null
    processedImage.value = null
    error.value = ''
    successMessage.value = ''
    processingTime.value = 0
    hazeDetectionResult.value = null
    processingResult.value = null
    imageStats.original = { width: 0, height: 0, size: '0 KB' }
    imageStats.processed = { width: 0, height: 0, size: '0 KB' }
  }

  return {
    // 状态
    selectedImage,
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
    handleImageFile,
    processImage,
    resetImage
  }
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小字符串
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
} 