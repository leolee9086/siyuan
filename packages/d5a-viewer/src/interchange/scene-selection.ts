import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  SkinnedMesh,
  type Object3D,
} from 'three'
import {
  createSceneDocumentFromObject,
  type SceneDocument,
  type SceneJsonValue,
} from './scene-document'

export interface SceneSelectionProjection {
  root: Group
  scene: SceneDocument
  sourceObjectIds: string[]
  dispose(): void
}

export interface SceneCompleteProjection {
  root: Object3D
  scene: SceneDocument
  dispose(): void
}

export function createCompleteSceneProjection(
  sourceRoot: Object3D,
  sourceScene: SceneDocument,
): SceneCompleteProjection {
  const root = sourceRoot.clone(true)
  shareRuntimeResources(sourceRoot, root)
  root.traverse((object) => {
    object.visible = true
  })
  const scene: SceneDocument = {
    ...sourceScene,
    nodes: sourceScene.nodes.map((node) => node.visible ? node : { ...node, visible: true }),
  }

  return {
    root,
    scene,
    dispose() {
      root.clear()
      root.removeFromParent()
    },
  }
}

export function createSceneSelectionProjection(
  sourceRoot: Object3D,
  sourceScene: SceneDocument,
  selectedObjectIds: Iterable<string>,
): SceneSelectionProjection {
  const requested = new Set(selectedObjectIds)
  if (requested.size === 0) throw new Error('请先选择至少一个可导出的网格')
  if (sourceScene.animations.length > 0) {
    throw new Error('带动画场景的部件导出需要保留轨道依赖，当前选择包含动画场景')
  }

  sourceRoot.updateWorldMatrix(true, true)
  const parentInverse = sourceRoot.parent
    ? sourceRoot.parent.matrixWorld.clone().invert()
    : new Matrix4()
  const selected: Mesh[] = []
  sourceRoot.traverse((object) => {
    if (object instanceof Mesh && requested.has(object.uuid)) selected.push(object)
  })
  if (selected.length === 0) throw new Error('选择中没有可导出的网格')

  const missing = [...requested].filter((id) => !selected.some((object) => object.uuid === id))
  if (missing.length > 0) throw new Error(`有 ${missing.length} 个选中部件已不在当前场景中`)
  const skinned = selected.find((object) => object instanceof SkinnedMesh)
  if (skinned) throw new Error(`蒙皮网格“${skinned.name || skinned.uuid}”需要连带骨骼后才能独立导出`)

  const root = new Group()
  root.name = `${sourceScene.name || sourceRoot.name || 'model'} selection`
  root.userData.selection = {
    sourceName: sourceScene.name,
    sourceFormat: sourceScene.sourceFormat,
    objectCount: selected.length,
  }

  for (const source of selected) {
    const clone = source.clone(false) as Mesh
    clone.geometry = source.geometry
    clone.material = source.material
    if (source instanceof InstancedMesh && clone instanceof InstancedMesh) {
      clone.instanceMatrix = source.instanceMatrix
      clone.instanceColor = source.instanceColor
      clone.morphTexture = source.morphTexture
    }
    clone.matrix.copy(new Matrix4().multiplyMatrices(parentInverse, source.matrixWorld))
    clone.matrixAutoUpdate = false
    clone.visible = true
    root.add(clone)
  }

  const extras: Record<string, SceneJsonValue> = {}
  for (const [key, value] of Object.entries(sourceScene.extras)) {
    if (key !== 'dimensions') extras[key] = value
  }
  extras.selection = {
    sourceName: sourceScene.name,
    sourceFormat: sourceScene.sourceFormat,
    objectCount: selected.length,
  }
  const scene = createSceneDocumentFromObject(root, {
    name: root.name,
    sourceFormat: sourceScene.sourceFormat,
    metersPerUnit: sourceScene.coordinateSystem.metersPerUnit,
    extras,
  })

  return {
    root,
    scene,
    sourceObjectIds: selected.map((object) => object.uuid),
    dispose() {
      root.clear()
      root.removeFromParent()
    },
  }
}

function shareRuntimeResources(source: Object3D, clone: Object3D): void {
  if (source instanceof Mesh && clone instanceof Mesh) {
    clone.geometry = source.geometry
    clone.material = source.material
  }
  if (source instanceof InstancedMesh && clone instanceof InstancedMesh) {
    clone.instanceMatrix = source.instanceMatrix
    clone.instanceColor = source.instanceColor
    clone.morphTexture = source.morphTexture
  }
  for (let index = 0; index < source.children.length; index += 1) {
    const sourceChild = source.children[index]
    const cloneChild = clone.children[index]
    if (sourceChild && cloneChild) shareRuntimeResources(sourceChild, cloneChild)
  }
}
