export function validateGlb(buffer: ArrayBuffer): void {
  if (buffer.byteLength < 20) throw new Error('GLB 文件过短')
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('文件缺少 glTF 二进制标记')
  const version = view.getUint32(4, true)
  if (version !== 2) throw new Error(`当前仅支持 GLB 2，文件版本为 ${version}`)
  const declaredLength = view.getUint32(8, true)
  if (declaredLength !== buffer.byteLength) {
    throw new Error(`GLB 声明长度 ${declaredLength} 与文件长度 ${buffer.byteLength} 不一致`)
  }
  const jsonLength = view.getUint32(12, true)
  const jsonType = view.getUint32(16, true)
  if (jsonType !== 0x4e4f534a || 20 + jsonLength > buffer.byteLength) {
    throw new Error('GLB JSON 块无效')
  }
}
