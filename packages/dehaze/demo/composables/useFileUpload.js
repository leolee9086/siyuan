/**
 * 文件上传组合式函数
 * @织: 文件上传和拖拽相关的响应式逻辑
 */

import { ref } from 'vue'
import { isValidImageFile } from '../utils/imageUtils.js'

/**
 * 文件上传状态管理
 */
export const useFileUpload = (handleImageFile) => {
  const fileInput = ref(null)
  const isDragOver = ref(false)

  /**
   * 触发文件选择
   */
  const triggerFileInput = () => {
    fileInput.value.click()
  }

  /**
   * 处理文件选择事件
   * @param {Event} event - 文件选择事件
   */
  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      handleImageFile(file)
      // 清空文件输入框，确保下次选择同一文件时也能触发change事件
      event.target.value = ''
    }
  }

  /**
   * 处理拖拽事件
   * @param {DragEvent} event - 拖拽事件
   */
  const handleDrop = (event) => {
    event.preventDefault()
    isDragOver.value = false
    
    const files = event.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (isValidImageFile(file)) {
        handleImageFile(file)
      } else {
        throw new Error('请选择有效的图片文件 (JPG, PNG, WebP, GIF, BMP)')
      }
    }
  }

  /**
   * 处理拖拽悬停事件
   * @param {DragEvent} event - 拖拽事件
   */
  const handleDragOver = (event) => {
    event.preventDefault()
    isDragOver.value = true
  }

  /**
   * 处理拖拽离开事件
   */
  const handleDragLeave = () => {
    isDragOver.value = false
  }

  return {
    fileInput,
    isDragOver,
    triggerFileInput,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave
  }
} 