declare module 'gltf-validator' {
  export interface GltfValidationMessage {
    code: string
    message: string
    severity: number
    pointer?: string
  }

  export interface GltfValidationReport {
    validatorVersion: string
    issues: {
      numErrors: number
      numWarnings: number
      numInfos: number
      numHints: number
      messages: GltfValidationMessage[]
      truncated: boolean
    }
  }

  export interface GltfValidationOptions {
    uri?: string
    format?: 'glb' | 'gltf'
    writeTimestamp?: boolean
    maxIssues?: number
    ignoredIssues?: string[]
    onlyIssues?: string[]
    severityOverrides?: Record<string, number>
  }

  export function validateBytes(
    data: Uint8Array,
    options?: GltfValidationOptions,
  ): Promise<GltfValidationReport>
}
