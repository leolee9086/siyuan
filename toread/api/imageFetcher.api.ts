/**
 * 图像获取 API
 */

import { cacheImage, getCachedImageByUrl } from '../components/control-panels/inputs/TextToImage/TextToImageTabContent.cache'

const POLLING_INTERVAL_MS = 2000 // 2 秒
const MAX_POLLING_ATTEMPTS = 30 // 最多尝试 30 次（60 秒）

/**
 * 轮询图像 URL 直到成功获取
 */
async function pollImageUrl(url: string): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_POLLING_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return response
      }
      console.log(`[pollImageUrl] 尝试 ${attempt}: 响应状态 ${response.status}, 等待重试...`)
    } catch (error) {
      console.log(`[pollImageUrl] 尝试 ${attempt}: 网络错误 ${error}, 等待重试...`)
    }
    // 等待间隔
    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS))
  }
  throw new Error(`图片获取超时（${MAX_POLLING_ATTEMPTS} 次尝试后）`)
}

/**
 * 将图像 URL 转换为 base64，带缓存功能
 */
export async function fetchImageAsBase64(url: string): Promise<string> {
  // 首先检查缓存中是否已有该图片
  const cachedImage = await getCachedImageByUrl(url)
  
  if (cachedImage) {
    console.log(`[fetchImageAsBase64] 缓存命中 URL: ${url}`)
    return cachedImage
  }

  console.log(`[fetchImageAsBase64] 缓存未命中，开始轮询 URL: ${url}`)
  // 如果缓存中没有，则轮询服务器直到成功获取
  const response = await pollImageUrl(url)
  const blob = await response.blob()
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = (): void => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('无法读取图像数据'))
    }
    reader.onerror = (): void => reject(reader.error ?? new Error('FileReader 错误'))
    reader.readAsDataURL(blob)
  })

  // 缓存新获取的图片，并关联 URL
  console.log(`[fetchImageAsBase64] 获取成功，开始缓存`)
  await cacheImage(base64, url)
  const cached = await getCachedImageByUrl(url)
  if (!cached) {
    throw new Error('图片没有正确缓存')
  }
  console.log(`[fetchImageAsBase64] 缓存验证成功`)
  return base64
}
