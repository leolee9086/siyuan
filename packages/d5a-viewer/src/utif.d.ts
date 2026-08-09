declare module 'utif' {
  export interface TiffIfd {
    width: number
    height: number
    data?: Uint8Array
    [key: string]: unknown
  }

  const UTIF: {
    decode(buffer: ArrayBuffer): TiffIfd[]
    decodeImage(buffer: ArrayBuffer, ifd: TiffIfd): void
    toRGBA8(ifd: TiffIfd): Uint8Array
  }

  export default UTIF
}
