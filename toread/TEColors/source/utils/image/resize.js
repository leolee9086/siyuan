export function 按最大边长缩放图像(image, maxSize) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let width = image.width;
    let height = image.height;

    // 计算缩放比例
    const scale = maxSize / Math.max(width, height);
    if (scale < 1) {
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);

    return canvas;
}
