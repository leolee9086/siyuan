import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { describe, expect, it } from 'vitest'
import { createSceneDocumentFromObject } from './scene-document'
import { createCompleteSceneProjection, createSceneSelectionProjection } from './scene-selection'

function triangleGeometry(offset = 0): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    offset, 0, 0,
    offset + 1, 0, 0,
    offset, 1, 0,
  ]), 3))
  return geometry
}

describe('scene selection projection', () => {
  it('creates an all-visible detached shell while sharing heavy runtime resources', () => {
    const viewportPivot = new Group()
    viewportPivot.rotation.y = 0.7
    const root = new Group()
    root.rotation.x = -Math.PI / 2
    const hiddenParent = new Group()
    hiddenParent.visible = false
    const geometry = triangleGeometry()
    const material = new MeshStandardMaterial({ name: 'shared' })
    const mesh = new Mesh(geometry, material)
    mesh.name = 'hidden-part'
    mesh.visible = false
    const instances = new InstancedMesh(geometry, material, 2)
    instances.name = 'hidden-instances'
    hiddenParent.add(mesh, instances)
    root.add(hiddenParent)
    viewportPivot.add(root)
    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'd5a-d5mesh-v10' })

    const projection = createCompleteSceneProjection(root, scene)
    const clonedMesh = projection.root.getObjectByName('hidden-part') as Mesh
    const clonedInstances = projection.root.getObjectByName('hidden-instances') as InstancedMesh

    expect(projection.root.parent).toBeNull()
    expect(projection.root.matrix.toArray()).toEqual(root.matrix.toArray())
    expect(projection.root.children[0]!.visible).toBe(true)
    expect(clonedMesh.visible).toBe(true)
    expect(clonedMesh.geometry).toBe(geometry)
    expect(clonedMesh.material).toBe(material)
    expect(clonedInstances.instanceMatrix).toBe(instances.instanceMatrix)
    expect(projection.scene.nodes.every((node) => node.visible)).toBe(true)
    expect(root.parent).toBe(viewportPivot)
    expect(hiddenParent.visible).toBe(false)
    expect(mesh.visible).toBe(false)

    projection.dispose()
    expect(projection.root.children).toHaveLength(0)
    expect(mesh.geometry).toBe(geometry)
  })

  it('flattens selected mesh transforms while borrowing geometry, material, and attribute storage', () => {
    const viewportPivot = new Group()
    viewportPivot.rotation.y = 0.4
    const root = new Group()
    root.rotation.x = -Math.PI / 2
    const assembly = new Group()
    assembly.position.set(3, 4, 5)
    const selectedGeometry = triangleGeometry()
    const skippedGeometry = triangleGeometry(10)
    const selectedMaterial = new MeshStandardMaterial({ name: 'selected' })
    const selected = new Mesh(selectedGeometry, selectedMaterial)
    selected.name = 'selected-part'
    selected.position.set(1, 2, 3)
    const skipped = new Mesh(skippedGeometry, new MeshStandardMaterial({ name: 'skipped' }))
    assembly.add(selected, skipped)
    root.add(assembly)
    viewportPivot.add(root)
    const scene = createSceneDocumentFromObject(root, {
      name: 'asset',
      sourceFormat: 'd5a-d5mesh-v11',
      extras: { dimensions: { length: 20, depth: 30, height: 40 }, productId: 'fixture' },
    })
    root.updateWorldMatrix(true, true)
    const expected = new Matrix4().multiplyMatrices(
      viewportPivot.matrixWorld.clone().invert(),
      selected.matrixWorld,
    )

    const projection = createSceneSelectionProjection(root, scene, [selected.uuid])
    const clone = projection.root.children[0] as Mesh
    const accessor = projection.scene.accessors.find((item) => item.sourceName === 'position')!

    expect(projection.root.children).toHaveLength(1)
    expect(clone.name).toBe('selected-part')
    expect(clone.geometry).toBe(selectedGeometry)
    expect(clone.material).toBe(selectedMaterial)
    expect(clone.matrix.toArray()).toEqual(expected.toArray())
    expect(accessor.array).toBe(selectedGeometry.getAttribute('position').array)
    expect(projection.scene.materials.map((material) => material.name)).toEqual(['selected'])
    expect(projection.scene.extras.dimensions).toBeUndefined()
    expect(projection.scene.extras.productId).toBe('fixture')
    expect(sourceRootState(root)).toEqual({ childCount: 1, selectedParent: assembly })

    projection.dispose()
    expect(projection.root.children).toHaveLength(0)
    expect(selected.geometry).toBe(selectedGeometry)
  })

  it('retains shared instance buffers and rejects stale or empty selections', () => {
    const root = new Group()
    const instances = new InstancedMesh(triangleGeometry(), new MeshStandardMaterial(), 3)
    instances.setMatrixAt(1, new Matrix4().makeTranslation(4, 0, 0))
    root.add(instances)
    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'glb-2.0' })

    const projection = createSceneSelectionProjection(root, scene, [instances.uuid])
    const clone = projection.root.children[0] as InstancedMesh
    const matrices = projection.scene.accessors.find((accessor) => accessor.sourceName === 'instanceMatrix')!

    expect(clone.geometry).toBe(instances.geometry)
    expect(clone.instanceMatrix).toBe(instances.instanceMatrix)
    expect(matrices.array).toBe(instances.instanceMatrix.array)
    expect(() => createSceneSelectionProjection(root, scene, [])).toThrow('请先选择')
    expect(() => createSceneSelectionProjection(root, scene, ['missing'])).toThrow('选择中没有')
  })
})

function sourceRootState(root: Group): { childCount: number; selectedParent: Group | null } {
  const selected = root.getObjectByName('selected-part')
  return { childCount: root.children.length, selectedParent: selected?.parent as Group | null }
}
