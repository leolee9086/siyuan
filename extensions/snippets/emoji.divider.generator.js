/**
 * Emoji分割线生成器
 * 用于动态生成所有emoji装饰符号的CSS样式
 */

/**
 * 获取所有emoji字符
 * 使用Unicode范围来获取emoji字符
 */
function 获取所有emoji() {
    const emojiRanges = [
        // 表情符号
        [0x1F600, 0x1F64F], // 表情符号
        [0x1F300, 0x1F5FF], // 各种符号和象形文字
        [0x1F680, 0x1F6FF], // 交通和地图符号
        [0x1F700, 0x1F77F], // 炼金术符号
        [0x1F780, 0x1F7FF], // 几何形状扩展
        [0x1F800, 0x1F8FF], // 补充箭头-C
        [0x1F900, 0x1F9FF], // 补充符号和象形文字
        [0x2600, 0x26FF],   // 杂项符号
        [0x2700, 0x27BF],   // 装饰符号
        // 更多的emoji范围...
    ];

    const emojis = [];
    
    emojiRanges.forEach(([start, end]) => {
        for (let codePoint = start; codePoint <= end; codePoint++) {
            // 跳过某些无效的码点
            if (isValidEmojiCodePoint(codePoint)) {
                emojis.push(String.fromCodePoint(codePoint));
            }
        }
    });

    // 添加一些常用的emoji
    const commonEmojis = [
        '❤', '✦', '✿', '◆', '●', '→', '〜', '⭐', '🌟', '💫', 
        '🌸', '🌺', '🌻', '🌹', '🍀', '🌙', '☀', '⚡', '🔥', '💧',
        '🌈', '☁', '❄', '🌊', '⚡', '🎯', '🎪', '🎨', '🎭', '🎪'
    ];
    
    return [...new Set([...emojis, ...commonEmojis])];
}

/**
 * 检查码点是否为有效的emoji
 */
function isValidEmojiCodePoint(codePoint) {
    // 排除一些非emoji字符
    const excludeRanges = [
        [0x1F1E6, 0x1F1FF], // 国旗符号（需要两个码点）
    ];
    
    return !excludeRanges.some(([start, end]) => 
        codePoint >= start && codePoint <= end
    );
}

/**
 * 生成emoji装饰符号的CSS样式
 */
function 生成Emoji装饰样式(emoji, 颜色 = null, 大小 = null) {
    const svgSize = 大小 || 16;
    const fontSize = 大小 || 16;
    const fillColor = 颜色 || '#ff6b6b';
    
    // 创建SVG
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${svgSize}' height='${svgSize}'>
        <text x='0' y='${fontSize - 2}' fill='${fillColor}' font-size='${fontSize}'>${emoji}</text>
    </svg>`;
    
    // URL编码
    const encodedSvg = encodeURIComponent(svg);
    
    return {
        css: `
            background-image: url("data:image/svg+xml,${encodedSvg}");
            background-repeat: repeat-x;
            background-size: ${svgSize}px ${svgSize}px;
            background-position: center;
            border: none;
            height: ${svgSize / 16}rem;
        `,
        svg: svg,
        encodedSvg: encodedSvg
    };
}

/**
 * 为所有emoji生成CSS类
 */
function 生成所有Emoji装饰样式() {
    const emojis = 获取所有emoji();
    const cssRules = [];
    
    emojis.forEach((emoji, index) => {
        const className = `emoji-${emoji}`;
        const style = 生成Emoji装饰样式(emoji);
        
        cssRules.push(`
.h6[custom-divider-style="${className}"] [contenteditable]::before,
.h6[custom-divider-style="${className}"] [contenteditable]::after {
    content: '';
    ${style.css}
}`);
    });
    
    return cssRules.join('\n');
}

/**
 * 将生成的CSS样式添加到document.head中
 */
function 将Emoji装饰样式添加到页面() {
    const cssContent = 生成所有Emoji装饰样式();
    
    // 创建style元素
    const styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.id = 'emoji-divider-styles';
    
    // 添加CSS内容
    styleElement.textContent = cssContent;
    
    // 检查是否已存在相同的样式，如果存在则先移除
    const existingStyle = document.getElementById('emoji-divider-styles');
    if (existingStyle) {
        document.head.removeChild(existingStyle);
    }
    
    // 将样式添加到head中
    document.head.appendChild(styleElement);
    
    return styleElement;
}

// 自动执行样式添加
将Emoji装饰样式添加到页面();

