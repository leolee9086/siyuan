import { describe, expect, it } from 'vitest'
import type { SceneDocument } from './scene-document'
import { readDxfStructure, writeDxfScene } from './dxf-format'

function fixtureScene(): SceneDocument {
  return {
    schemaVersion: 1,
    name: 'DXF fixture',
    sourceFormat: 'test',
    coordinateSystem: { handedness: 'right', upAxis: 'Y', metersPerUnit: 1 },
    roots: ['root'],
    nodes: [
      {
        id: 'root', name: 'Root',
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        children: ['triangle'], visible: true, extras: {},
      },
      {
        id: 'triangle', name: 'Part/One',
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1],
        children: [], mesh: 'mesh', visible: true, extras: {},
      },
    ],
    meshes: [{
      id: 'mesh', name: 'Triangle',
      primitives: [{
        id: 'primitive', mode: 'triangles',
        attributes: { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' },
        indices: 'index', material: 'red', morphTargets: [], start: 0, count: 3,
      }],
    }],
    accessors: [
      {
        id: 'position', sourceName: 'position',
        array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        itemSize: 3, count: 3, normalized: false, offset: 0, stride: 3, usage: 35044,
      },
      {
        id: 'normal', sourceName: 'normal',
        array: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        itemSize: 3, count: 3, normalized: false, offset: 0, stride: 3, usage: 35044,
      },
      {
        id: 'uv', sourceName: 'uv', array: new Float32Array([0, 0, 1, 0, 0, 1]),
        itemSize: 2, count: 3, normalized: false, offset: 0, stride: 2, usage: 35044,
      },
      {
        id: 'index', sourceName: 'index', array: new Uint16Array([0, 1, 2]),
        itemSize: 1, count: 3, normalized: false, offset: 0, stride: 1, usage: 35044,
      },
    ],
    materials: [{
      id: 'red', name: 'Red:Material', model: 'PBR',
      pbr: {
        baseColor: [1, 0, 0, 1], emissive: [0, 0, 0], metalness: 0,
        roughness: 1, opacity: 1, alphaMode: 'opaque', alphaCutoff: 0.5, doubleSided: true,
      },
      textures: [], extras: {},
    }],
    textures: [], images: [], skins: [], animations: [], extras: {},
  }
}

describe('DXF scene format', () => {
  it('writes meter-based Z-up 3DFACE geometry and reads world bounds back as Y-up', async () => {
    const written = writeDxfScene(fixtureScene())
    const text = await written.dxf.text()
    const read = await readDxfStructure(written.dxf)

    expect(written.faceCount).toBe(1)
    expect(written.layerCount).toBe(1)
    expect(text).toContain('$INSUNITS\r\n70\r\n6')
    expect(text).toContain('0\r\n3DFACE')
    expect(text).toContain('420\r\n16711680')
    expect(text).toContain('Part_One__Red_Material')
    expect(read).toMatchObject({
      faceCount: 1,
      quadCount: 0,
      usedLayerCount: 1,
      declaredLayerCount: 2,
      unsupportedEntityCount: 0,
      bounds: { min: [1, 2, 3], max: [2, 3, 3] },
    })
    expect(written.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      'dxf-uv-not-representable',
      'dxf-shading-basis-derived',
      'dxf-hierarchy-flattened',
    ]))
  })

  it('expands instance matrices without losing triangle count', async () => {
    const scene = fixtureScene()
    scene.accessors.push({
      id: 'instances', sourceName: 'instanceMatrix',
      array: new Float32Array([
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1,
      ]),
      itemSize: 16, count: 2, normalized: false, offset: 0, stride: 16, usage: 35044,
    })
    scene.nodes[1]!.instances = { count: 2, matrices: 'instances' }

    const written = writeDxfScene(scene)
    const read = await readDxfStructure(written.dxf)

    expect(written.faceCount).toBe(2)
    expect(read.faceCount).toBe(2)
    expect(read.bounds).toEqual({ min: [1, 2, 3], max: [12, 3, 3] })
    expect(written.diagnostics.some((diagnostic) => diagnostic.code === 'dxf-instances-expanded')).toBe(true)
  })

  it('rejects structurally incomplete DXF output', async () => {
    await expect(readDxfStructure(new Blob([
      '0\r\nSECTION\r\n2\r\nENTITIES\r\n0\r\n3DFACE\r\n'
      + '10\r\n0\r\n20\r\n0\r\n30\r\n0\r\n'
      + '11\r\n1\r\n21\r\n0\r\n31\r\n0\r\n'
      + '12\r\n0\r\n22\r\n1\r\n32\r\n0\r\n',
    ]))).rejects.toThrow('EOF')
  })
})
