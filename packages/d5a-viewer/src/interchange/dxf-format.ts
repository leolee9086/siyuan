import { Matrix4 } from 'three'
import {
  validateSceneDocument,
  type SceneAccessor,
  type SceneDocument,
  type SceneMaterial,
  type SceneNode,
  type ScenePrimitive,
} from './scene-document'

export interface DxfDiagnostic {
  severity: 'warning' | 'error'
  code: string
  message: string
  path?: string
}

export interface DxfWriteOptions {
  signal?: AbortSignal
  onProgress?: (completed: number, total: number, message: string) => void
}

export interface DxfWriteResult {
  dxf: Blob
  faceCount: number
  layerCount: number
  diagnostics: DxfDiagnostic[]
}

export interface DxfBounds {
  min: [number, number, number]
  max: [number, number, number]
}

export interface DxfReadResult {
  faceCount: number
  quadCount: number
  usedLayerCount: number
  declaredLayerCount: number
  unsupportedEntityCount: number
  bounds?: DxfBounds
  diagnostics: DxfDiagnostic[]
}

interface VisibleNodePlacement {
  node: SceneNode
  world: Matrix4
}

interface DxfLayer {
  key: string
  name: string
  trueColor: number
  transparency: number
}

interface DxfEntity {
  type: string
  fields: Map<number, string>
}

const IDENTITY = new Matrix4()
const DXF_CHUNK_CHARACTERS = 1024 * 1024
const DXF_METERS = 6

export function writeDxfScene(scene: SceneDocument, options: DxfWriteOptions = {}): DxfWriteResult {
  throwIfAborted(options.signal)
  const validationErrors = validateSceneDocument(scene).filter((issue) => issue.severity === 'error')
  if (validationErrors.length > 0) {
    throw new Error(`DXF 写出前场景验证失败: ${validationErrors.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`)
  }

  const nodes = new Map(scene.nodes.map((node) => [node.id, node]))
  const meshes = new Map(scene.meshes.map((mesh) => [mesh.id, mesh]))
  const accessors = new Map(scene.accessors.map((accessor) => [accessor.id, accessor]))
  const materials = new Map(scene.materials.map((material) => [material.id, material]))
  const placements = visibleNodePlacements(scene, nodes)
  const diagnostics = collectFormatDiagnostics(scene, placements)
  const layers = createLayers(placements, meshes, materials)
  const layerByKey = new Map(layers.map((layer) => [layer.key, layer]))
  const estimatedFaces = placements.reduce((total, placement) => {
    const mesh = placement.node.mesh ? meshes.get(placement.node.mesh) : undefined
    if (!mesh) return total
    const copies = placement.node.instances?.count ?? 1
    return total + mesh.primitives.reduce((subtotal, primitive) =>
      subtotal + (primitive.mode === 'triangles' ? Math.floor(primitive.count / 3) * copies : 0), 0)
  }, 0)
  if (estimatedFaces === 0) throw new Error('场景中没有可写入 DXF 的可见三角面')

  const parts: BlobPart[] = [dxfPreamble(scene.name, layers)]
  let chunk = ''
  let faceCount = 0
  const flush = (): void => {
    if (!chunk) return
    parts.push(chunk)
    chunk = ''
  }
  const appendFace = (layer: DxfLayer, matrix: Matrix4, a: number, b: number, c: number, position: SceneAccessor): void => {
    const va = transformedDxfPoint(position, a, matrix)
    const vb = transformedDxfPoint(position, b, matrix)
    const vc = transformedDxfPoint(position, c, matrix)
    chunk += dxfFace(layer, va, vb, vc)
    faceCount += 1
    if (chunk.length >= DXF_CHUNK_CHARACTERS) flush()
    if ((faceCount & 0x3fff) === 0) {
      throwIfAborted(options.signal)
      options.onProgress?.(faceCount, estimatedFaces, `写入 ${faceCount.toLocaleString()} / ${estimatedFaces.toLocaleString()} 个 DXF 面`)
    }
  }

  for (const placement of placements) {
    throwIfAborted(options.signal)
    const node = placement.node
    const mesh = node.mesh ? meshes.get(node.mesh) : undefined
    if (!mesh) continue
    const instanceMatrices = node.instances
      ? accessors.get(node.instances.matrices)
      : undefined
    const copies = node.instances?.count ?? 1
    if (node.instances && (!instanceMatrices || instanceMatrices.itemSize < 16 || instanceMatrices.count < copies)) {
      throw new Error(`节点 ${node.id} 的实例矩阵访问器无效`)
    }
    for (let copy = 0; copy < copies; copy += 1) {
      const matrix = node.instances
        ? placement.world.clone().multiply(accessorMatrix(instanceMatrices!, copy))
        : placement.world
      for (const primitive of mesh.primitives) {
        if (primitive.mode !== 'triangles') continue
        const position = accessors.get(primitive.attributes.POSITION ?? '')
        if (!position || position.itemSize < 3) {
          diagnostics.push({
            severity: 'warning',
            code: 'position-missing',
            path: `meshes.${mesh.id}.primitives.${primitive.id}`,
            message: `图元 ${primitive.id} 缺少可用 POSITION，已跳过`,
          })
          continue
        }
        const indices = primitive.indices ? accessors.get(primitive.indices) : undefined
        if (primitive.indices && !indices) throw new Error(`图元 ${primitive.id} 的索引访问器不存在`)
        const layer = layerByKey.get(layerKey(node, primitive))
        if (!layer) throw new Error(`图元 ${primitive.id} 的 DXF 图层未建立`)
        const completeCount = primitive.count - primitive.count % 3
        if (completeCount !== primitive.count) {
          diagnostics.push({
            severity: 'warning',
            code: 'incomplete-triangle-omitted',
            path: `meshes.${mesh.id}.primitives.${primitive.id}`,
            message: `图元末尾 ${primitive.count - completeCount} 个元素不能组成三角形，已省略`,
          })
        }
        for (let offset = 0; offset < completeCount; offset += 3) {
          appendFace(
            layer,
            matrix,
            primitiveVertex(indices, primitive.start + offset, position.count, primitive.id),
            primitiveVertex(indices, primitive.start + offset + 1, position.count, primitive.id),
            primitiveVertex(indices, primitive.start + offset + 2, position.count, primitive.id),
            position,
          )
        }
      }
    }
  }
  flush()
  parts.push('0\r\nENDSEC\r\n0\r\nEOF\r\n')
  options.onProgress?.(faceCount, estimatedFaces, `DXF 已写入 ${faceCount.toLocaleString()} 个三角面`)
  return {
    dxf: new Blob(parts, { type: 'application/dxf' }),
    faceCount,
    layerCount: layers.length,
    diagnostics: dedupeDiagnostics(diagnostics),
  }
}

export async function readDxfStructure(file: Blob, signal?: AbortSignal): Promise<DxfReadResult> {
  let section = ''
  let awaitingSectionName = false
  let current: DxfEntity | undefined
  let headerVariable = ''
  let insertionUnits = DXF_METERS
  let sawEof = false
  let faceCount = 0
  let quadCount = 0
  let unsupportedEntityCount = 0
  const declaredLayers = new Set<string>()
  const usedLayers = new Set<string>()
  const missingLayers = new Set<string>()
  const diagnostics: DxfDiagnostic[] = []
  const minimum = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const maximum = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]

  const includePoint = (point: [number, number, number]): void => {
    for (let component = 0; component < 3; component += 1) {
      minimum[component] = Math.min(minimum[component]!, point[component]!)
      maximum[component] = Math.max(maximum[component]!, point[component]!)
    }
  }
  const flushEntity = (): void => {
    if (!current) return
    if (section === 'TABLES' && current.type === 'LAYER') {
      const name = current.fields.get(2)?.trim()
      if (name) declaredLayers.add(name.toLocaleLowerCase())
    } else if (section === 'ENTITIES') {
      if (current.type === '3DFACE') {
        const layer = current.fields.get(8)?.trim() || '0'
        usedLayers.add(layer.toLocaleLowerCase())
        if (!declaredLayers.has(layer.toLocaleLowerCase()) && layer !== '0') missingLayers.add(layer)
        const a = dxfEntityPoint(current, 0)
        const b = dxfEntityPoint(current, 1)
        const c = dxfEntityPoint(current, 2)
        const d = dxfEntityPoint(current, 3, c)
        includePoint(dxfToYUp(a))
        includePoint(dxfToYUp(b))
        includePoint(dxfToYUp(c))
        faceCount += 1
        if (!samePoint(c, d)) {
          includePoint(dxfToYUp(d))
          faceCount += 1
          quadCount += 1
        }
      } else {
        unsupportedEntityCount += 1
      }
    }
    current = undefined
  }

  for await (const [code, rawValue] of dxfPairs(file, signal)) {
    const value = rawValue.trim()
    if (code === 0) {
      flushEntity()
      const type = value.toUpperCase()
      if (type === 'SECTION') {
        awaitingSectionName = true
      } else if (type === 'ENDSEC') {
        section = ''
      } else if (type === 'EOF') {
        sawEof = true
      } else if (type !== 'TABLE' && type !== 'ENDTAB') {
        current = { type, fields: new Map() }
      }
      continue
    }
    if (awaitingSectionName && code === 2) {
      section = value.toUpperCase()
      awaitingSectionName = false
      continue
    }
    if (section === 'HEADER') {
      if (code === 9) headerVariable = value.toUpperCase()
      else if (headerVariable === '$INSUNITS' && code === 70) insertionUnits = integerValue(value, '$INSUNITS')
    }
    current?.fields.set(code, rawValue)
  }
  flushEntity()
  if (!sawEof) throw new Error('DXF 缺少 EOF 结束标记')
  if (faceCount === 0) throw new Error('DXF ENTITIES 中没有 3DFACE 几何')
  if (insertionUnits !== DXF_METERS) {
    diagnostics.push({
      severity: 'warning',
      code: 'dxf-units-not-meters',
      message: `DXF $INSUNITS=${insertionUnits}，本工具写出约定应为米制 6`,
    })
  }
  if (unsupportedEntityCount > 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'unsupported-dxf-entities',
      message: `${unsupportedEntityCount} 个非 3DFACE 实体未计入结构回读`,
    })
  }
  if (missingLayers.size > 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'undeclared-dxf-layers',
      message: `${missingLayers.size} 个实体图层未在 LAYER 表声明`,
    })
  }
  return {
    faceCount,
    quadCount,
    usedLayerCount: usedLayers.size,
    declaredLayerCount: declaredLayers.size,
    unsupportedEntityCount,
    bounds: {
      min: minimum as [number, number, number],
      max: maximum as [number, number, number],
    },
    diagnostics,
  }
}

function visibleNodePlacements(scene: SceneDocument, nodes: Map<string, SceneNode>): VisibleNodePlacement[] {
  const placements: VisibleNodePlacement[] = []
  const stack = [...scene.roots].reverse().map((id) => ({ id, parent: IDENTITY }))
  while (stack.length > 0) {
    const entry = stack.pop()!
    const node = nodes.get(entry.id)
    if (!node || !node.visible) continue
    if (node.matrix.length !== 16) throw new Error(`节点 ${node.id} 的矩阵长度不是 16`)
    const world = entry.parent.clone().multiply(new Matrix4().fromArray(node.matrix))
    placements.push({ node, world })
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push({ id: node.children[index]!, parent: world })
    }
  }
  return placements
}

function createLayers(
  placements: VisibleNodePlacement[],
  meshes: Map<string, SceneDocument['meshes'][number]>,
  materials: Map<string, SceneMaterial>,
): DxfLayer[] {
  const layers: DxfLayer[] = []
  const usedNames = new Set<string>()
  for (const { node } of placements) {
    const mesh = node.mesh ? meshes.get(node.mesh) : undefined
    if (!mesh) continue
    for (const primitive of mesh.primitives) {
      if (primitive.mode !== 'triangles' || !primitive.attributes.POSITION || primitive.count < 3) continue
      const material = primitive.material ? materials.get(primitive.material) : undefined
      const partName = node.name || mesh.name || node.id
      const materialName = material?.name || primitive.material || 'Default'
      const requested = sanitizeLayerName(`${partName}__${materialName}`)
      const name = uniqueLayerName(requested, usedNames)
      const color = materialColor(material)
      layers.push({
        key: layerKey(node, primitive),
        name,
        trueColor: (color[0] << 16) | (color[1] << 8) | color[2],
        transparency: Math.round((1 - clamp01(material?.pbr.opacity ?? 1)) * 255),
      })
    }
  }
  return layers
}

function collectFormatDiagnostics(scene: SceneDocument, placements: VisibleNodePlacement[]): DxfDiagnostic[] {
  const diagnostics: DxfDiagnostic[] = []
  if (scene.textures.length > 0 || scene.images.length > 0) diagnostics.push({
    severity: 'warning', code: 'dxf-textures-not-representable',
    message: 'DXF 3DFACE 不承载表面纹理；材质只保留为部件图层和 True Color',
  })
  if (scene.accessors.some((accessor) => /^uv\d*$/i.test(accessor.sourceName))) diagnostics.push({
    severity: 'warning', code: 'dxf-uv-not-representable',
    message: 'DXF 3DFACE 不承载逐顶点 UV；UV 数据未写入',
  })
  if (scene.accessors.some((accessor) => /normal|tangent/i.test(accessor.sourceName))) diagnostics.push({
    severity: 'warning', code: 'dxf-shading-basis-derived',
    message: 'DXF 3DFACE 不承载顶点法线或切线；目标工具将从面几何重建着色基',
  })
  if (scene.animations.length > 0) diagnostics.push({
    severity: 'warning', code: 'dxf-animation-omitted', message: `${scene.animations.length} 个动画未写入静态 DXF`,
  })
  if (scene.skins.length > 0) diagnostics.push({
    severity: 'warning', code: 'dxf-skin-omitted', message: `${scene.skins.length} 个蒙皮仅按当前静态几何写入`,
  })
  const morphTargets = scene.meshes.reduce((total, mesh) =>
    total + mesh.primitives.reduce((sum, primitive) => sum + primitive.morphTargets.length, 0), 0)
  if (morphTargets > 0) diagnostics.push({
    severity: 'warning', code: 'dxf-morph-targets-omitted', message: `${morphTargets} 组变形目标未写入静态 DXF`,
  })
  const instances = placements.reduce((total, placement) => total + Math.max(0, (placement.node.instances?.count ?? 1) - 1), 0)
  if (instances > 0) diagnostics.push({
    severity: 'warning', code: 'dxf-instances-expanded', message: `${instances} 个额外实例已展开为独立 3DFACE`,
  })
  const nonTriangles = scene.meshes.reduce((total, mesh) =>
    total + mesh.primitives.filter((primitive) => primitive.mode !== 'triangles').length, 0)
  if (nonTriangles > 0) diagnostics.push({
    severity: 'warning', code: 'dxf-non-triangle-primitives-omitted', message: `${nonTriangles} 个点线图元未写入 3DFACE`,
  })
  if (scene.nodes.length > 1) diagnostics.push({
    severity: 'warning', code: 'dxf-hierarchy-flattened',
    message: '节点世界变换已应用到顶点；部件和材质边界保留为图层，父子层级不写入',
  })
  return diagnostics
}

function dxfPreamble(name: string, layers: DxfLayer[]): string {
  let output = '999\r\nD5 Asset Studio ASCII DXF export\r\n'
  output += `999\r\n${singleLine(name || 'scene')}\r\n`
  output += '0\r\nSECTION\r\n2\r\nHEADER\r\n'
  output += '9\r\n$ACADVER\r\n1\r\nAC1024\r\n'
  output += '9\r\n$DWGCODEPAGE\r\n3\r\nUTF-8\r\n'
  output += `9\r\n$INSUNITS\r\n70\r\n${DXF_METERS}\r\n`
  output += '9\r\n$MEASUREMENT\r\n70\r\n1\r\n0\r\nENDSEC\r\n'
  output += '0\r\nSECTION\r\n2\r\nTABLES\r\n'
  output += '0\r\nTABLE\r\n2\r\nLTYPE\r\n70\r\n1\r\n'
  output += '0\r\nLTYPE\r\n100\r\nAcDbSymbolTableRecord\r\n100\r\nAcDbLinetypeTableRecord\r\n2\r\nCONTINUOUS\r\n70\r\n0\r\n3\r\nSolid line\r\n72\r\n65\r\n73\r\n0\r\n40\r\n0\r\n0\r\nENDTAB\r\n'
  output += `0\r\nTABLE\r\n2\r\nLAYER\r\n70\r\n${layers.length + 1}\r\n`
  output += dxfLayerRecord({ key: '0', name: '0', trueColor: 0xffffff, transparency: 0 })
  for (const layer of layers) output += dxfLayerRecord(layer)
  output += '0\r\nENDTAB\r\n0\r\nENDSEC\r\n'
  output += '0\r\nSECTION\r\n2\r\nENTITIES\r\n'
  return output
}

function dxfLayerRecord(layer: DxfLayer): string {
  let output = '0\r\nLAYER\r\n100\r\nAcDbSymbolTableRecord\r\n100\r\nAcDbLayerTableRecord\r\n'
  output += `2\r\n${layer.name}\r\n70\r\n0\r\n62\r\n7\r\n420\r\n${layer.trueColor}\r\n`
  if (layer.transparency > 0) output += `440\r\n${0x02000000 | layer.transparency}\r\n`
  output += '6\r\nCONTINUOUS\r\n'
  return output
}

function dxfFace(
  layer: DxfLayer,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): string {
  let output = `0\r\n3DFACE\r\n100\r\nAcDbEntity\r\n8\r\n${layer.name}\r\n420\r\n${layer.trueColor}\r\n100\r\nAcDbFace\r\n`
  const points = [a, b, c, c]
  for (let vertex = 0; vertex < 4; vertex += 1) {
    const point = points[vertex]!
    output += `${10 + vertex}\r\n${numberText(point[0])}\r\n`
    output += `${20 + vertex}\r\n${numberText(point[1])}\r\n`
    output += `${30 + vertex}\r\n${numberText(point[2])}\r\n`
  }
  return output
}

function transformedDxfPoint(
  position: SceneAccessor,
  index: number,
  matrix: Matrix4,
): [number, number, number] {
  const x = accessorNumber(position, index, 0)
  const y = accessorNumber(position, index, 1)
  const z = accessorNumber(position, index, 2)
  const elements = matrix.elements
  const denominator = elements[3]! * x + elements[7]! * y + elements[11]! * z + elements[15]!
  const inverseW = denominator === 0 ? 1 : 1 / denominator
  const worldX = (elements[0]! * x + elements[4]! * y + elements[8]! * z + elements[12]!) * inverseW
  const worldY = (elements[1]! * x + elements[5]! * y + elements[9]! * z + elements[13]!) * inverseW
  const worldZ = (elements[2]! * x + elements[6]! * y + elements[10]! * z + elements[14]!) * inverseW
  return [finite(worldX), finite(-worldZ), finite(worldY)]
}

function accessorMatrix(accessor: SceneAccessor, index: number): Matrix4 {
  return new Matrix4().fromArray(Array.from({ length: 16 }, (_, component) => accessorNumber(accessor, index, component)))
}

function primitiveVertex(
  indices: SceneAccessor | undefined,
  element: number,
  positionCount: number,
  primitiveId: string,
): number {
  const value = indices ? accessorNumber(indices, element, 0) : element
  if (!Number.isInteger(value) || value < 0 || value >= positionCount) {
    throw new Error(`图元 ${primitiveId} 的顶点索引 ${value} 超出 0..${positionCount - 1}`)
  }
  return value
}

function accessorNumber(accessor: SceneAccessor, item: number, component: number): number {
  if (item < 0 || item >= accessor.count || component < 0 || component >= accessor.itemSize) {
    throw new Error(`${accessor.id}[${item},${component}] 超出访问范围`)
  }
  const raw = accessor.array[accessor.offset + item * accessor.stride + component]
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new Error(`${accessor.id}[${item},${component}] 不是有限数值`)
  if (!accessor.normalized) return raw
  if (accessor.array instanceof Int8Array) return Math.max(raw / 127, -1)
  if (accessor.array instanceof Uint8Array || accessor.array instanceof Uint8ClampedArray) return raw / 255
  if (accessor.array instanceof Int16Array) return Math.max(raw / 32767, -1)
  if (accessor.array instanceof Uint16Array) return raw / 65535
  if (accessor.array instanceof Int32Array) return Math.max(raw / 2147483647, -1)
  if (accessor.array instanceof Uint32Array) return raw / 4294967295
  return raw
}

async function* dxfPairs(file: Blob, signal?: AbortSignal): AsyncGenerator<[number, string]> {
  let codeLine: string | undefined
  for await (const line of textLines(file, signal)) {
    if (codeLine == null) {
      codeLine = line
      continue
    }
    const code = Number.parseInt(codeLine.replace(/^\uFEFF/, '').trim(), 10)
    if (!Number.isInteger(code)) throw new Error(`DXF 组码无效: ${codeLine}`)
    yield [code, line]
    codeLine = undefined
  }
  if (codeLine != null && codeLine.trim()) throw new Error('DXF 最后一个组码缺少值')
}

async function* textLines(file: Blob, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = file.stream().getReader()
  const decoder = new TextDecoder('utf-8')
  let pending = ''
  try {
    while (true) {
      throwIfAborted(signal)
      const { done, value } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      let newline = pending.indexOf('\n')
      while (newline >= 0) {
        const line = pending.slice(0, newline)
        yield line.endsWith('\r') ? line.slice(0, -1) : line
        pending = pending.slice(newline + 1)
        newline = pending.indexOf('\n')
      }
    }
    pending += decoder.decode()
    if (pending) yield pending.endsWith('\r') ? pending.slice(0, -1) : pending
  } finally {
    reader.releaseLock()
  }
}

function dxfEntityPoint(entity: DxfEntity, vertex: number, fallback?: [number, number, number]): [number, number, number] {
  const x = entity.fields.get(10 + vertex)
  const y = entity.fields.get(20 + vertex)
  const z = entity.fields.get(30 + vertex)
  if (fallback && x == null && y == null && z == null) return fallback
  return [
    numericValue(x, `${entity.type}.${10 + vertex}`),
    numericValue(y, `${entity.type}.${20 + vertex}`),
    numericValue(z, `${entity.type}.${30 + vertex}`),
  ]
}

function dxfToYUp(point: [number, number, number]): [number, number, number] {
  return [point[0], point[2], -point[1]]
}

function numericValue(value: string | undefined, label: string): number {
  if (value == null) throw new Error(`DXF ${label} 缺失`)
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed)) throw new Error(`DXF ${label} 不是有限数值`)
  return parsed
}

function integerValue(value: string, label: string): number {
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isInteger(parsed)) throw new Error(`DXF ${label} 不是整数`)
  return parsed
}

function layerKey(node: SceneNode, primitive: ScenePrimitive): string {
  return `${node.id}\u0000${primitive.id}`
}

function uniqueLayerName(requested: string, used: Set<string>): string {
  const base = requested || 'Part'
  let name = base.slice(0, 255)
  let suffix = 2
  while (used.has(name.toLocaleLowerCase())) {
    const tag = `_${suffix++}`
    name = `${base.slice(0, 255 - tag.length)}${tag}`
  }
  used.add(name.toLocaleLowerCase())
  return name
}

function sanitizeLayerName(value: string): string {
  return singleLine(value).replace(/[<>/\\"`:;?*|=,]/g, '_').trim() || 'Part'
}

function singleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 255)
}

function materialColor(material?: SceneMaterial): [number, number, number] {
  const source = material?.pbr.baseColor ?? [0.72, 0.72, 0.72, 1]
  return [linearByte(source[0]), linearByte(source[1]), linearByte(source[2])]
}

function linearByte(value: number): number {
  const linear = clamp01(value)
  const srgb = linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055
  return Math.round(clamp01(srgb) * 255)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function numberText(value: number): string {
  const normalized = Math.abs(value) < 1e-12 ? 0 : finite(value)
  return normalized.toPrecision(12).replace(/(?:\.0+|(?:(\.\d*?)0+))(?=e|$)/, '$1')
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('DXF 顶点坐标不是有限数值')
  return value
}

function samePoint(left: [number, number, number], right: [number, number, number]): boolean {
  return Math.abs(left[0] - right[0]) <= 1e-9
    && Math.abs(left[1] - right[1]) <= 1e-9
    && Math.abs(left[2] - right[2]) <= 1e-9
}

function dedupeDiagnostics(diagnostics: DxfDiagnostic[]): DxfDiagnostic[] {
  const seen = new Set<string>()
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.severity}\u0000${diagnostic.code}\u0000${diagnostic.path ?? ''}\u0000${diagnostic.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('DXF 写出已取消', 'AbortError')
}
