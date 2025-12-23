/**
 * 注意,这里需要使用esm.sh编译版本的transformerjs
 * 这样才能够在electron的渲染进程中跑起来
 * 如果你愿意创建一个单独的进程并且不给它node环境的话,也可以不用下面这些操作
 * 如果你使用webworker,也不用下面这些操作
 * 注意如果使用webpack,不要将打包目标设置为高于es2022,否则会出问题
 * 有时间我再说一下怎么在思源里面直接实现类似ollama的模型加载功能,如果做补全可能有用
 * 相关文件见app\stage\protyle\js\transformers.js
 * @param content 
 */
export const embeddingText = async (content: string): Promise<Float32Array> => {
    //@ts-ignore
    const transformers = await import(/* webpackIgnore: true */ "/stage/protyle/js/transformers.js");
    //wasm位置,注意路径最后的斜杠
    transformers.env.backends.onnx.wasm.wasmPaths = "/stage/protyle/js/@huggingface/transformers@3.8.0/";
    //允许使用远程模型
    transformers.env.allowRemoteModels = true;
    //当使用本地模型时会通过这个路径去读取
    transformers.env.localModelPath = "/public/onnxModels/";


    let node_version;
    if (window.process) {
        node_version = window.process.versions.node;
        //由于onnx_runtime会通过这个属性判断是否是node环境而且在electron下会有一些问题,所以需要临时将它hack

        Object.defineProperty(window.process.versions, "node", {
            value: undefined,
            writable: true,
            configurable: true,
            enumerable: true
        });
    }

    //const { pipeline } =await import(/* webpackIgnore: true */'https://esm.sh/@huggingface/transformers');
    //这里使用动态导入处理会比较简单
    //@ts-ignore
    const { pipeline } = await import(/* webpackIgnore: true */ "/stage/protyle/js/transformers.js");

    const extractor = await pipeline(
        "feature-extraction",
        //这个是我量化处理的一个中文嵌入效果还不错的模型,如果你要用其它模型,注意它对中文的效果
        //由于时间有限,模型下载持久化暂时没有移植过来,之后移植好了再看
        "leolee9086/text2vec-base-chinese",
        {
            device: "webgpu",
            model_file_name: "model_quantized",

        },
    );
    if (window.process) {
        //恢复之前hack的内容
        Object.defineProperty(window.process.versions, "node", {
            value: node_version,
            writable: false,
            configurable: false,
            enumerable: true
        });
    }

    const embeddings = await extractor(content, { pooling: "mean", normalize: true });
    // embeddings.data 是 Float32Array
    return embeddings.data;
};
