/**
 * WebGPU着色器模块
 * 包含去雾算法所需的所有着色器代码
 * @author 织
 */

/**
 * 创建计算暗通道的着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
export const createDarkChannelShader = (device) => {
  return device.createShaderModule({
    label: 'DarkChannelShader',
    code: `
      struct Uniforms {
        width: f32,
        height: f32,
        windowSize: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var inputTexture: texture_2d<f32>;
      @group(0) @binding(2) var<storage, read_write> outputBuffer: array<f32>;
      
      @compute @workgroup_size(16, 8)
      fn computeDarkChannel(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let x = globalId.x;
        let y = globalId.y;
        
        if (x >= u32(uniforms.width) || y >= u32(uniforms.height)) {
          return;
        }
        
        let halfWindow = u32(uniforms.windowSize / 2.0);
        var minValue: f32 = 1.0;
        
        // 计算实际有效的窗口范围，避免采样到图像边界之外
        let startX = max(halfWindow, x);
        let endX = min(u32(uniforms.width) - 1 - halfWindow, x);
        let startY = max(halfWindow, y);
        let endY = min(u32(uniforms.height) - 1 - halfWindow, y);
        
        // 如果当前像素在边缘区域，使用较小的窗口
        var actualHalfWindow = halfWindow;
        if (x < halfWindow || x >= u32(uniforms.width) - halfWindow ||
            y < halfWindow || y >= u32(uniforms.height) - halfWindow) {
          // 边缘区域使用较小的窗口，避免采样到图像外
          actualHalfWindow = min(halfWindow, min(x, min(u32(uniforms.width) - 1 - x,
                                                     min(y, u32(uniforms.height) - 1 - y))));
        }
        
        for (var wy = y - actualHalfWindow; wy <= y + actualHalfWindow; wy++) {
          for (var wx = x - actualHalfWindow; wx <= x + actualHalfWindow; wx++) {
            // 确保不采样到图像边界之外
            if (wx < u32(uniforms.width) && wy < u32(uniforms.height)) {
              let pixel = textureLoad(inputTexture, vec2<i32>(i32(wx), i32(wy)), 0);
              // rgba8unorm格式已经返回0-1范围的f32值
              
              // 改进：使用人眼亮度权重计算暗通道
              // ITU-R BT.709标准：R:0.299, G:0.587, B:0.114
              let luminance = pixel.r * 0.299 + pixel.g * 0.587 + pixel.b * 0.114;
              let minChannel = min(min(pixel.r, pixel.g), pixel.b);
              
              // 结合亮度信息和最小通道值，更准确地估计暗通道
              let darkChannel = min(luminance, minChannel);
              minValue = min(minValue, darkChannel);
            }
          }
        }
        
        let outputIndex = y * u32(uniforms.width) + x;
        outputBuffer[outputIndex] = minValue;
      }
    `
  });
};

/**
 * 创建估计透射率的着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
export const createTransmissionShader = (device) => {
  return device.createShaderModule({
    label: 'TransmissionShader',
    code: `
      struct Uniforms {
        width: f32,
        height: f32,
        atmosphericLight: f32,
        omega: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read> darkChannelBuffer: array<f32>;
      @group(0) @binding(2) var<storage, read_write> transmissionBuffer: array<f32>;
      
      @compute @workgroup_size(16, 8)
      fn estimateTransmission(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let x = globalId.x;
        let y = globalId.y;
        
        if (x >= u32(uniforms.width) || y >= u32(uniforms.height)) {
          return;
        }
        
        let pixelIndex = y * u32(uniforms.width) + x;
        let darkValue = darkChannelBuffer[pixelIndex];
        let transmission = 1.0 - uniforms.omega * (darkValue / uniforms.atmosphericLight);
        transmissionBuffer[pixelIndex] = transmission;
      }
    `
  });
};

/**
 * 创建空间自适应透射率估计着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
export const createSpatialAdaptiveTransmissionShader = (device) => {
  return device.createShaderModule({
    label: 'SpatialAdaptiveTransmissionShader',
    code: `
      struct Uniforms {
        width: f32,
        height: f32,
        atmosphericLight: f32,
        userOmega: f32,
        userT0: f32,
        omegaAdjustRange: f32,
        t0AdjustRange: f32,
        hazeWeight: f32,
        atmosphericWeight: f32,
        adaptiveStrength: f32,
        _padding: f32, // 填充字段，确保16字节对齐
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read> darkChannelBuffer: array<f32>;
      @group(0) @binding(2) var<storage, read_write> transmissionBuffer: array<f32>;
      
      // 计算空间自适应omega和t0的函数
      fn computeSpatialAdaptiveParameters(darkValue: f32) -> vec2<f32> {
        // 基于暗通道值计算雾强度因子
        let hazeFactor = min(1.0, darkValue * 1.5);
        
        // 基于大气光调整因子
        let atmosphericFactor = min(1.0, uniforms.atmosphericLight * 1.2);
        
        // 基于暗通道值计算对比度因子 - 修复：雾越浓的地方需要更强的去雾
        let contrastFactor = min(1.0, darkValue * 1.2);
        
        // 综合计算自适应因子
        let adaptiveFactor = 
          uniforms.hazeWeight * hazeFactor +
          uniforms.atmosphericWeight * atmosphericFactor +
          (1.0 - uniforms.hazeWeight - uniforms.atmosphericWeight) * contrastFactor;
        
        // 基于雾强度分布进行相对调整
        // 使用雾强度作为基准，根据adaptiveStrength进行相对增强或减弱
        var adjustedAdaptiveFactor: f32;
        if (uniforms.adaptiveStrength < 1.0) {
          // 保守模式：基于雾强度相对减弱自适应效果
          // 雾强度越高，减弱效果越明显
          let reductionFactor = 1.0 - uniforms.adaptiveStrength;
          adjustedAdaptiveFactor = adaptiveFactor * (1.0 - reductionFactor * adaptiveFactor);
        } else if (uniforms.adaptiveStrength > 1.0) {
          // 激进模式：基于雾强度相对增强自适应效果
          // 雾强度越高，增强效果越明显
          let enhancementFactor = uniforms.adaptiveStrength - 1.0;
          let relativeEnhancement = enhancementFactor * adaptiveFactor;
          adjustedAdaptiveFactor = min(1.0, adaptiveFactor + relativeEnhancement);
        } else {
          // 标准模式：保持原始自适应因子
          adjustedAdaptiveFactor = adaptiveFactor;
        }
        
        // 基于用户设置的omega进行自适应调整
        let omegaAdjustment = uniforms.omegaAdjustRange * adjustedAdaptiveFactor;
        let adaptiveOmega = uniforms.userOmega + omegaAdjustment;
        
        // 基于用户设置的t0进行自适应调整
        let t0Adjustment = uniforms.t0AdjustRange * adjustedAdaptiveFactor;
        let adaptiveT0 = uniforms.userT0 + t0Adjustment;
        
        // 限制在有效范围内
        return vec2<f32>(
          clamp(adaptiveOmega, 0.1, 0.99),
          clamp(adaptiveT0, 0.01, 0.3)
        );
      }
      
      @compute @workgroup_size(16, 8)
      fn estimateSpatialAdaptiveTransmission(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let x = globalId.x;
        let y = globalId.y;
        
        if (x >= u32(uniforms.width) || y >= u32(uniforms.height)) {
          return;
        }
        
        let pixelIndex = y * u32(uniforms.width) + x;
        let darkValue = darkChannelBuffer[pixelIndex];
        
        // 计算该像素位置的自适应参数
        let adaptiveParams = computeSpatialAdaptiveParameters(darkValue);
        let adaptiveOmega = adaptiveParams.x;
        let adaptiveT0 = adaptiveParams.y;
        
        // 使用自适应omega计算透射率
        var transmission = 1.0 - adaptiveOmega * (darkValue / uniforms.atmosphericLight);
        
        // 限制透射率最小值
        transmission = max(transmission, adaptiveT0);
        transmissionBuffer[pixelIndex] = transmission;
      }
    `
  });
};

/**
 * 创建恢复图像的着色器模块（改进版，支持分别的RGB大气光）
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
export const createRecoverImageShader = (device) => {
  return device.createShaderModule({
    label: 'RecoverImageShader',
    code: /* wgsl */`
      struct Uniforms {
        width: f32,
        height: f32,
        atmosphericLightR: f32,
        atmosphericLightG: f32,
        atmosphericLightB: f32,
        atmosphericLightLuminance: f32,
        t0: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var inputTexture: texture_2d<f32>;
      @group(0) @binding(2) var<storage, read> transmissionBuffer: array<f32>;
      @group(0) @binding(3) var<storage, read_write> outputBuffer: array<f32>;
      
      @compute @workgroup_size(16, 8)
      fn recoverImage(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let x = globalId.x;
        let y = globalId.y;
        
        if (x >= u32(uniforms.width) || y >= u32(uniforms.height)) {
          return;
        }
        
        // 移除Y坐标翻转，直接使用原始坐标
        let pos = vec2<i32>(i32(x), i32(y));
        let pixel = textureLoad(inputTexture, pos, 0);
        
        // rgba8unorm格式已经返回0-1范围的f32值
        let r = pixel.r;
        let g = pixel.g;
        let b = pixel.b;
        let a = pixel.a;
        
        let transmission = max(transmissionBuffer[y * u32(uniforms.width) + x], uniforms.t0);
        
        // 改进：基于亮度的恢复，保持色彩平衡
        // 计算原始亮度
        let originalLuminance = r * 0.299 + g * 0.587 + b * 0.114;
        
        // 基于亮度进行恢复
        let recoveredLuminance = (originalLuminance - uniforms.atmosphericLightLuminance) / transmission + uniforms.atmosphericLightLuminance;
        
        // 计算亮度变化比例
        let luminanceRatio = recoveredLuminance / max(originalLuminance, 1e-6);
        
        // 分别恢复RGB通道，保持色彩比例
        let recoveredR = (r - uniforms.atmosphericLightR) / transmission + uniforms.atmosphericLightR;
        let recoveredG = (g - uniforms.atmosphericLightG) / transmission + uniforms.atmosphericLightG;
        let recoveredB = (b - uniforms.atmosphericLightB) / transmission + uniforms.atmosphericLightB;
        
        // 结合亮度恢复和色彩恢复，确保自然效果
        let finalR = mix(recoveredR, r * luminanceRatio, 0.7);
        let finalG = mix(recoveredG, g * luminanceRatio, 0.7);
        let finalB = mix(recoveredB, b * luminanceRatio, 0.7);
        
        let outputIndex = (y * u32(uniforms.width) + x) * 4u;
        // 直接写入f32值，不转换为u32
        outputBuffer[outputIndex] = clamp(finalR, 0.0, 1.0);
        outputBuffer[outputIndex + 1u] = clamp(finalG, 0.0, 1.0);
        outputBuffer[outputIndex + 2u] = clamp(finalB, 0.0, 1.0);
        outputBuffer[outputIndex + 3u] = a;
      }
    `
  });
}; 

/**
 * 创建支持饱和度和对比度增强的图像恢复着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
export const createEnhancedRecoverImageShader = (device) => {
  return device.createShaderModule({
    label: 'EnhancedRecoverImageShader',
    code: `
      struct Uniforms {
        width: f32,
        height: f32,
        atmosphericLightR: f32,
        atmosphericLightG: f32,
        atmosphericLightB: f32,
        atmosphericLightLuminance: f32,
        t0: f32,
        saturationEnhancement: f32,  // 饱和度增强因子 (0.0-2.0)
        contrastEnhancement: f32,    // 对比度增强因子 (0.5-2.0)
        brightnessEnhancement: f32,  // 明度增强因子 (0.5-2.0)
        enableEnhancement: f32,      // 是否启用增强 (0.0或1.0)
        _padding1: f32,              // 填充以满足16字节对齐
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var inputTexture: texture_2d<f32>;
      @group(0) @binding(2) var<storage, read> transmissionBuffer: array<f32>;
      @group(0) @binding(3) var<storage, read_write> outputBuffer: array<f32>;
      
      // RGB转HSV函数
      fn rgbToHsv(r: f32, g: f32, b: f32) -> vec3<f32> {
        let maxVal = max(max(r, g), b);
        let minVal = min(min(r, g), b);
        let delta = maxVal - minVal;
        
        var h: f32 = 0.0;
        var s: f32 = 0.0;
        let v = maxVal;
        
        if (delta != 0.0) {
          if (maxVal == r) {
            h = ((g - b) / delta) % 6.0;
          } else if (maxVal == g) {
            h = (b - r) / delta + 2.0;
          } else {
            h = (r - g) / delta + 4.0;
          }
          h = h * 60.0;
          if (h < 0.0) {
            h = h + 360.0;
          }
          
          if (maxVal != 0.0) {
            s = delta / maxVal;
          }
        }
        
        return vec3<f32>(h, s, v);
      }
      
      // HSV转RGB函数
      fn hsvToRgb(h: f32, s: f32, v: f32) -> vec3<f32> {
        let c = v * s;
        let x = c * (1.0 - abs((h / 60.0) % 2.0 - 1.0));
        let m = v - c;
        
        var r: f32 = 0.0;
        var g: f32 = 0.0;
        var b: f32 = 0.0;
        
        if (h < 60.0) {
          r = c; g = x; b = 0.0;
        } else if (h < 120.0) {
          r = x; g = c; b = 0.0;
        } else if (h < 180.0) {
          r = 0.0; g = c; b = x;
        } else if (h < 240.0) {
          r = 0.0; g = x; b = c;
        } else if (h < 300.0) {
          r = x; g = 0.0; b = c;
        } else {
          r = c; g = 0.0; b = x;
        }
        
        return vec3<f32>(r + m, g + m, b + m);
      }
      
      // 饱和度增强函数
      fn enhanceSaturation(r: f32, g: f32, b: f32, factor: f32) -> vec3<f32> {
        let hsv = rgbToHsv(r, g, b);
        let enhancedS = clamp(hsv.y * factor, 0.0, 1.0);
        return hsvToRgb(hsv.x, enhancedS, hsv.z);
      }
      
      // 对比度增强函数
      fn enhanceContrast(r: f32, g: f32, b: f32, factor: f32) -> vec3<f32> {
        return vec3<f32>(
          clamp((r - 0.5) * factor + 0.5, 0.0, 1.0),
          clamp((g - 0.5) * factor + 0.5, 0.0, 1.0),
          clamp((b - 0.5) * factor + 0.5, 0.0, 1.0)
        );
      }
      
      // 明度增强函数
      fn enhanceBrightness(r: f32, g: f32, b: f32, factor: f32) -> vec3<f32> {
        return vec3<f32>(
          clamp(r * factor, 0.0, 1.0),
          clamp(g * factor, 0.0, 1.0),
          clamp(b * factor, 0.0, 1.0)
        );
      }
      
      @compute @workgroup_size(16, 8)
      fn recoverImage(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let x = globalId.x;
        let y = globalId.y;
        
        if (x >= u32(uniforms.width) || y >= u32(uniforms.height)) {
          return;
        }
        
        // 获取原始像素
        let pos = vec2<i32>(i32(x), i32(y));
        let pixel = textureLoad(inputTexture, pos, 0);
        
        let r = pixel.r;
        let g = pixel.g;
        let b = pixel.b;
        let a = pixel.a;
        
        let transmission = max(transmissionBuffer[y * u32(uniforms.width) + x], uniforms.t0);
        
        // 计算原始亮度
        let originalLuminance = r * 0.299 + g * 0.587 + b * 0.114;
        
        // 基于亮度进行恢复
        let recoveredLuminance = (originalLuminance - uniforms.atmosphericLightLuminance) / transmission + uniforms.atmosphericLightLuminance;
        
        // 计算亮度变化比例
        let luminanceRatio = recoveredLuminance / max(originalLuminance, 1e-6);
        
        // 分别恢复RGB通道，保持色彩比例
        let recoveredR = (r - uniforms.atmosphericLightR) / transmission + uniforms.atmosphericLightR;
        let recoveredG = (g - uniforms.atmosphericLightG) / transmission + uniforms.atmosphericLightG;
        let recoveredB = (b - uniforms.atmosphericLightB) / transmission + uniforms.atmosphericLightB;
        
        // 结合亮度恢复和色彩恢复，确保自然效果
        var finalR = mix(recoveredR, r * luminanceRatio, 0.7);
        var finalG = mix(recoveredG, g * luminanceRatio, 0.7);
        var finalB = mix(recoveredB, b * luminanceRatio, 0.7);
        
        // 如果启用增强功能，应用饱和度、对比度和明度增强
        if (uniforms.enableEnhancement > 0.5) {
          // 应用饱和度增强
          let saturated = enhanceSaturation(finalR, finalG, finalB, uniforms.saturationEnhancement);
          
          // 应用对比度增强
          let contrasted = enhanceContrast(saturated.x, saturated.y, saturated.z, uniforms.contrastEnhancement);
          
          // 应用明度增强
          let brightened = enhanceBrightness(contrasted.x, contrasted.y, contrasted.z, uniforms.brightnessEnhancement);
          
          finalR = brightened.x;
          finalG = brightened.y;
          finalB = brightened.z;
        }
        
        let outputIndex = (y * u32(uniforms.width) + x) * 4u;
        // 直接写入f32值，不转换为u32
        outputBuffer[outputIndex] = clamp(finalR, 0.0, 1.0);
        outputBuffer[outputIndex + 1u] = clamp(finalG, 0.0, 1.0);
        outputBuffer[outputIndex + 2u] = clamp(finalB, 0.0, 1.0);
        outputBuffer[outputIndex + 3u] = a;
      }
    `
  });
}; 