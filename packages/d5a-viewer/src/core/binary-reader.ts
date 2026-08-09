export class D5ParseError extends Error {
  readonly offset: number

  constructor(message: string, offset: number) {
    super(`${message} (offset 0x${offset.toString(16)})`)
    this.name = 'D5ParseError'
    this.offset = offset
  }
}

export class BinaryReader {
  readonly buffer: ArrayBuffer
  readonly view: DataView
  offset = 0

  constructor(buffer: ArrayBuffer, offset = 0) {
    this.buffer = buffer
    this.view = new DataView(buffer)
    this.seek(offset)
  }

  get length(): number {
    return this.buffer.byteLength
  }

  get remaining(): number {
    return this.length - this.offset
  }

  seek(offset: number): void {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > this.length) {
      throw new D5ParseError(`Invalid seek target ${offset}`, this.offset)
    }
    this.offset = offset
  }

  skip(bytes: number): void {
    this.ensure(bytes, 'skip')
    this.offset += bytes
  }

  uint32(): number {
    this.ensure(4, 'uint32')
    const value = this.view.getUint32(this.offset, true)
    this.offset += 4
    return value
  }

  float32(): number {
    this.ensure(4, 'float32')
    const value = this.view.getFloat32(this.offset, true)
    this.offset += 4
    return value
  }

  utf16(length: number): string {
    const bytes = this.checkedByteLength(length, 2, 'UTF-16 string')
    this.ensure(bytes, 'UTF-16 string')
    const value = new TextDecoder('utf-16le').decode(
      new Uint8Array(this.buffer, this.offset, bytes),
    )
    this.offset += bytes
    return value
  }

  countedUtf16(maxCharacters = 1_048_576): string {
    const countOffset = this.offset
    const length = this.uint32()
    if (length > maxCharacters) {
      throw new D5ParseError(
        `UTF-16 string length ${length} exceeds ${maxCharacters}`,
        countOffset,
      )
    }
    return this.utf16(length)
  }

  utf8(length: number): string {
    this.ensure(length, 'UTF-8 string')
    const value = new TextDecoder('utf-8').decode(
      new Uint8Array(this.buffer, this.offset, length),
    )
    this.offset += length
    return value
  }

  countedUtf8(maxBytes = 1_048_576): string {
    const countOffset = this.offset
    const length = this.uint32()
    if (length > maxBytes) {
      throw new D5ParseError(`UTF-8 string length ${length} exceeds ${maxBytes}`, countOffset)
    }
    return this.utf8(length)
  }

  float32Array(count: number, label: string): Float32Array {
    const bytes = this.checkedByteLength(count, 4, label)
    this.ensure(bytes, label)
    const result = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      result[index] = this.view.getFloat32(this.offset + index * 4, true)
    }
    this.offset += bytes
    return result
  }

  uint32Array(count: number, label: string): Uint32Array {
    const bytes = this.checkedByteLength(count, 4, label)
    this.ensure(bytes, label)
    const result = new Uint32Array(count)
    for (let index = 0; index < count; index += 1) {
      result[index] = this.view.getUint32(this.offset + index * 4, true)
    }
    this.offset += bytes
    return result
  }

  countedFloat32Array(label: string): Float32Array {
    const countOffset = this.offset
    const count = this.uint32()
    this.assertCountFits(count, 4, label, countOffset)
    return this.float32Array(count, label)
  }

  countedUint32Array(label: string): Uint32Array {
    const countOffset = this.offset
    const count = this.uint32()
    this.assertCountFits(count, 4, label, countOffset)
    return this.uint32Array(count, label)
  }

  private checkedByteLength(count: number, stride: number, label: string): number {
    if (!Number.isSafeInteger(count) || count < 0 || count > Math.floor(Number.MAX_SAFE_INTEGER / stride)) {
      throw new D5ParseError(`Invalid ${label} count ${count}`, this.offset)
    }
    return count * stride
  }

  private assertCountFits(count: number, stride: number, label: string, offset: number): void {
    const bytes = this.checkedByteLength(count, stride, label)
    if (bytes > this.remaining) {
      throw new D5ParseError(
        `${label} requires ${bytes.toLocaleString()} bytes, only ${this.remaining.toLocaleString()} remain`,
        offset,
      )
    }
  }

  private ensure(bytes: number, label: string): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.remaining) {
      throw new D5ParseError(
        `Cannot read ${label}: need ${bytes} bytes, ${this.remaining} remain`,
        this.offset,
      )
    }
  }
}
