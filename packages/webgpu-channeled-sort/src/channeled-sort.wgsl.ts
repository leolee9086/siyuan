export default `
@group(0) @binding(0) var<storage, read_write> data: array<PixelProjection>;
@group(0) @binding(1) var<uniform> params: Params;

struct PixelProjection {
    value: f32,
    pixelOffset: u32,
};

struct Params {
    stage: u32,               // 双调排序阶段
    pass_of_stage: u32,       // 双调排序阶段中的步骤
    element_count: u32,       // 元素数量
    total_invocations: u32,   // 总线程数
};

// 双调排序核心逻辑，同时交换值和像素偏移
fn bitonic_sort_channel(global_id: vec3<u32>) {
    let thread_index = global_id.x;
    let element_count = params.element_count;
    let j = 1u << params.pass_of_stage;
    let k = 1u << (params.stage + 1u);
    
    // 每个线程通过循环处理多个元素
    let total_invocations = params.total_invocations;
    for (var i = thread_index; i < element_count; i = i + total_invocations) {
        let ix = i;
        let jx = ix ^ j;
        
        // 合并条件检查，减少分支发散
        if (jx >= element_count || jx < ix) {
            continue;
        }
        
        let direction_is_ascending = ((ix & k) == 0u);
        
        // 比较和交换，同时交换值和像素偏移
        if (direction_is_ascending == (data[ix].value > data[jx].value)) {
            let temp_value = data[ix].value;
            let temp_offset = data[ix].pixelOffset;
            data[ix].value = data[jx].value;
            data[ix].pixelOffset = data[jx].pixelOffset;
            data[jx].value = temp_value;
            data[jx].pixelOffset = temp_offset;
        }
    }
}

@compute @workgroup_size(256)
fn sort_channel(@builtin(global_invocation_id) global_id: vec3<u32>) {
    // 执行双调排序
    bitonic_sort_channel(global_id);
}`