/**
 * 图像处理工具函数
 * @织: 图像处理相关的纯函数工具
 */

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 验证图像文件类型
 * @param {File} file - 文件对象
 * @returns {boolean} 是否为有效的图像文件
 */
export const isValidImageFile = (file) => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']
  return validTypes.includes(file.type) || file.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i)
}

/**
 * 创建图像元素并加载
 * @param {string} src - 图像源
 * @returns {Promise<HTMLImageElement>} 加载完成的图像元素
 */
export const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * 从文件创建图像数据
 * @param {File} file - 图像文件
 * @returns {Promise<{imageData: ImageData, width: number, height: number}>} 图像数据
 */
export const createImageDataFromFile = async (file) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  const img = await loadImage(URL.createObjectURL(file))
  canvas.width = img.width
  canvas.height = img.height
  ctx.drawImage(img, 0, 0)
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return {
    imageData,
    width: img.width,
    height: img.height
  }
}

/**
 * 估算图像数据大小
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {string} 格式化后的估算大小
 */
export const estimateImageDataSize = (width, height) => {
  const estimatedBytes = width * height * 4 // RGBA每像素4字节
  return formatFileSize(estimatedBytes)
} 