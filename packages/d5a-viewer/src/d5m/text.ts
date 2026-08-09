import type { D5mTextEncoding } from './types'

export interface DecodedD5mText {
  text: string
  encoding: D5mTextEncoding
  bom: boolean
}

export function decodeD5mText(bytes: Uint8Array): DecodedD5mText {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2)),
      encoding: 'utf-16le',
      bom: true,
    }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      text: new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2)),
      encoding: 'utf-16be',
      bom: true,
    }
  }
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  return {
    text: new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(hasUtf8Bom ? 3 : 0)),
    encoding: 'utf-8',
    bom: hasUtf8Bom,
  }
}

export function encodeD5mText(text: string, encoding: D5mTextEncoding, bom: boolean): Uint8Array {
  if (encoding === 'utf-8') {
    const content = new TextEncoder().encode(text)
    if (!bom) return content
    const output = new Uint8Array(content.length + 3)
    output.set([0xef, 0xbb, 0xbf])
    output.set(content, 3)
    return output
  }

  const prefix = bom ? 2 : 0
  const output = new Uint8Array(prefix + text.length * 2)
  if (bom) output.set(encoding === 'utf-16le' ? [0xff, 0xfe] : [0xfe, 0xff])
  const view = new DataView(output.buffer)
  for (let index = 0; index < text.length; index += 1) {
    view.setUint16(prefix + index * 2, text.charCodeAt(index), encoding === 'utf-16le')
  }
  return output
}
