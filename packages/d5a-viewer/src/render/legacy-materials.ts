export interface LegacyMaterialSpec {
  name: string
  color: string
  opacity: number
  roughness: number
  metallic: number
  diffuseMap?: string
  normalMap?: string
  roughnessMap?: string
}

export function parseLegacyMaterials(xml: string | undefined): LegacyMaterialSpec[] {
  if (!xml) return []
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror')) return []
  return [...document.querySelectorAll('Material')].flatMap((material) => {
    const name = text(material, 'Name')
    if (!name) return []
    return [{
      name,
      color: text(material, 'DiffuseColor') || '#b7bbb8',
      opacity: number(material, 'Opacity', 1),
      roughness: number(material, 'Roughness', 0.72),
      metallic: number(material, 'Metallic', 0),
      diffuseMap: texturePath(material, 'DiffuseTexture'),
      normalMap: texturePath(material, 'BumpTexture'),
      roughnessMap: texturePath(material, 'RoughnessTexture'),
    }]
  })
}

function texturePath(material: Element, selector: string): string | undefined {
  const value = text(material, `${selector} > Filepath`)
  if (!value) return undefined
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '')
  return normalized.toLowerCase().startsWith('textures/') ? normalized : `textures/${normalized}`
}

function text(element: Element, selector: string): string {
  return element.querySelector(selector)?.textContent?.trim() ?? ''
}

function number(element: Element, selector: string, fallback: number): number {
  const value = Number(text(element, selector))
  return Number.isFinite(value) ? value : fallback
}
