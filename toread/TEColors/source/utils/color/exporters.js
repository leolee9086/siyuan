import Konva from '../../../static/konva.js'
import chroma from '../../../static/chroma-js.js'
import { combinations } from '../Array/combinations.js';
import fs from '../../polyfills/fs.js'
import path from '../../polyfills/path.js'

export function 导出色卡图片(swatchs) {
    const width = 220; // Width of the container remains fixed
    // Calculate dynamic height based on number of swatches
    const rectHeight = 40;
    const spacing = 10;
    const totalHeight = swatchs.length * (rectHeight + spacing) + 20; // Additional padding at top and bottom
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '50%';
    container.style.top = '50%';
    container.style.transform = 'translate(-50%, -50%)'; // Center the container on screen
    // Create the stage with dynamic height
    const stage = new Konva.Stage({
        container: container,
        width: width,
        height: totalHeight
    });
    // Create a layer
    const layer = new Konva.Layer();
    stage.add(layer);
    const rectWidth = width * 0.8;
    const startX = (width - rectWidth) / 2;
    let startY = 10;
    // Create rectangles and text for each swatch
    swatchs.forEach(swatch => {
        const rect = new Konva.Rect({
            x: startX,
            y: startY,
            width: rectWidth,
            height: rectHeight,
            fill: rgbArrayToHex(swatch), // Convert RGB array to CSS color string
            cornerRadius: 10
        });
        layer.add(rect);

        const text = new Konva.Text({
            x: startX,
            y: startY + (rectHeight / 2) - 6, // Center text vertically
            text: rgbArrayToHex(swatch),
            fontSize: 12,
            fontFamily: 'Arial',
            fill: '#000',
            width: rectWidth,
            align: 'center',
            verticalAlign: 'middle'
        });
        layer.add(text);

        startY += rectHeight + spacing;
    });
    // Draw the layer
    layer.draw();
    // Convert the stage to a data URL and trigger download
    const dataURL = stage.toDataURL();
    try {
        writeDataURL(dataURL)
    } catch (e) {
        console.warn(e)
    }
    return dataURL

}
function rgbToHex(r, g, b) {
    return chroma(r, g, b).hex();
}

function rgbArrayToHex(a) {
    return chroma(...a).hex();
}

async function writeDataURL(dataURL, identifier = '') {
    const matches = dataURL.match(/^data:(.+?);base64,(.*)$/);
    if (!matches) {
        console.error('Invalid data URL');
        return;
    }
    const mimeType = matches[1];
    const base64Data = matches[2];

    // 使用 atob 解码 base64 数据并转换为 Uint8Array
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // 根据 MIME 类型确定文件扩展名
    let extension;
    switch (mimeType) {
        case 'image/jpeg':
            extension = 'jpg';
            break;
        case 'image/png':
            extension = 'png';
            break;
        case 'image/gif':
            extension = 'gif';
            break;
        default:
            console.error('Unsupported MIME type:', mimeType);
            return;
    }

    // 确保目录存在
    const dirPath = '/temp/export';
    // 动态创建文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // ISO string, safe for filenames
    const fileName = `swatch_image_${identifier}_${timestamp}.${extension}`;
    const filePath = path.join(dirPath, fileName);
    // 写入文件
    fs.writeFile(filePath, bytes);
}
export function 分组导出色卡图片(swatchs, groupSize = 5) {
    const allCombinations = combinations(swatchs, groupSize);
    let data = []
    for (const group of allCombinations) {
        data.push(导出色卡图片(group))
    }
    return data
}