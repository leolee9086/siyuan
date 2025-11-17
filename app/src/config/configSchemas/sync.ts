import { z } from 'zod'

const s3Schema = z.object({
    accessKey: z.string(),
    bucket: z.string(),
    endpoint: z.string(),
    pathStyle: z.boolean(),
    region: z.string(),
    secretKey: z.string(),
    skipTlsVerify: z.boolean(),
    timeout: z.number(),
    concurrentReqs: z.number()
})

const webdavSchema = z.object({
    endpoint: z.string(),
    password: z.string(),
    skipTlsVerify: z.boolean(),
    timeout: z.number(),
    concurrentReqs: z.number(),
    username: z.string()
})

const localSchema = z.object({
    endpoint: z.string(),
    timeout: z.number(),
    concurrentReqs: z.number()
})

export const schema = z.object({
    cloudName: z.string(),
    enabled: z.boolean(),
    generateConflictDoc: z.boolean(),
    mode: z.number(),
    interval: z.number(),
    perception: z.boolean(),
    provider: z.number(),
    s3: s3Schema,
    stat: z.string(),
    synced: z.number(),
    webdav: webdavSchema,
    local: localSchema
})


export const parseAsSyncConfig = (rawConf: {}): Config.IConf['sync'] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`同步配置解析失败: ${result.error.message}`);
    }

    return result.data;
}