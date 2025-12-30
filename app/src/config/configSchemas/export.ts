import z from "zod";

export const schema = z.object({
    addTitle: z.boolean(),
    blockEmbedMode: z.number(),
    blockRefMode: z.number(),
    blockRefTextLeft: z.string(),
    blockRefTextRight: z.string(),
    docxTemplate: z.string(),
    fileAnnotationRefMode: z.number(),
    imageWatermarkDesc: z.string(),
    imageWatermarkStr: z.string(),
    markdownYFM: z.boolean(),
    inlineMemo: z.boolean(),
    pandocBin: z.string(),
    paragraphBeginningSpace: z.boolean(),
    pdfFooter: z.string(),
    pdfWatermarkDesc: z.string(),
    pdfWatermarkStr: z.string(),
    tagCloseMarker: z.string(),
    tagOpenMarker: z.string()
});

const parseAsConfig = (rawConf: object): Config.IConf["export"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }

    return result.data;
};