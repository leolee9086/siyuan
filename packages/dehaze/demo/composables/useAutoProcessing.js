import { ref } from 'vue'

/**
 * 自动图像处理组合式函数
 * 提供防抖和异步锁功能，避免频繁处理
 */
export const useAutoProcessing = () => {
  // 异步锁，防止重复处理
  const isProcessing = ref(false)
  // 防抖定时器
  const debounceTimer = ref(null)
  // 防抖延迟时间（毫秒）
  const DEBOUNCE_DELAY = 300

  /**
   * 防抖处理函数
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 延迟时间
   */
  const debounce = (fn, delay) => {
    return (...args) => {
      if (debounceTimer.value) {
        clearTimeout(debounceTimer.value)
      }
      debounceTimer.value = setTimeout(() => {
        fn(...args)
      }, delay)
    }
  }

  /**
   * 创建自动处理触发器
   * @param {Function} processFunction - 处理函数
   * @returns {Function} 防抖版本的触发函数
   */
  const createAutoProcessor = (processFunction) => {
    const executeProcessing = async () => {
      if (isProcessing.value) {
        return // 如果正在处理，直接返回
      }

      try {
        isProcessing.value = true
        await processFunction()
      } catch (error) {
        console.error('自动处理失败:', error)
      } finally {
        isProcessing.value = false
      }
    }

    return debounce(executeProcessing, DEBOUNCE_DELAY)
  }

  /**
   * 清理防抖定时器
   */
  const cleanup = () => {
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
      debounceTimer.value = null
    }
  }

  return {
    isProcessing,
    createAutoProcessor,
    cleanup
  }
} 