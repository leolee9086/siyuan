export const embeddingText = async (content: string) => {

    const { pipeline } =await import('@huggingface/transformers');

    const extractor = await pipeline(
        "feature-extraction",
        "leolee9086/text2vec-base-chinese",
        {
            device: "cpu", model_file_name: "model_quantized"
        },
    );
    const embeddings = await extractor(content, { pooling: "mean", normalize: true });
    console.log(embeddings)
}
