import { pinyin } from 'pinyin-pro'

/**
 * 将中文字符串转换为拼音字符串
 * @param text 要转换的中文文本
 * @returns 拼音字符串（不带声调）
 */
export const convertToPinyin = (text: string): string => {
  if (!text) return ''
  
  try {
    // 使用 pinyin-pro 库转换，去除声调，保留空格分隔
    const result = pinyin(text, { toneType: 'none', type: 'array' })
    return result.join(' ')
  } catch (error) {
    console.error('拼音转换错误:', error)
    return text
  }
}

/**
 * 检查文本是否匹配搜索关键词（支持中文原文和拼音搜索）
 * @param text 要搜索的文本
 * @param keyword 搜索关键词
 * @returns 是否匹配
 */
export const matchPinyinSearch = (text: string, keyword: string): boolean => {
  if (!keyword) return true
  if (!text) return false
  
  const lowerText = text.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  
  // 原文匹配
  if (lowerText.includes(lowerKeyword)) {
    return true
  }
  
  // 拼音匹配
  const textPinyin = convertToPinyin(text).toLowerCase()
  if (textPinyin.includes(lowerKeyword)) {
    return true
  }
  
  return false
}