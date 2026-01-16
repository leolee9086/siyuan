import { 按最大边长缩放图像 } from './resize.js'
import { kMeans } from './colorAnalyzer/kmeans.js';
export function 使用指定算法提取图像颜色(图像, 算法, 结果数量 = 13, 回调函数) {
    if (算法 === 'gpt4o') {
        return 使用gpt4o提取图像颜色(图像, 结果数量, 回调函数)
    }
    const canvas = 按最大边长缩放图像(图像, Math.min(图像.width/10,128));
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const clusters = kMeans(data, 结果数量, 算法);
    if (回调函数) {
        try { 回调函数(clusters) } catch (e) {
            console.warn('颜色提取回调函数错误', e, e.stack)
        }
    }
    return clusters
}
function 使用gpt4o提取图像颜色(图像, 结果数量 = 13, 回调函数) {
    const canvas = 按最大边长缩放图像(图像, Math.min(图像.width/10,128));
    canvas.toBlob(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result;
            const 模型调用基础地址 = window.siyuan.config.ai.openAI.apiBaseURL;
            const messages= [
                {
                  role: "user",
                  content: [
                    { type: "text", text: `从这张图像中提取1到${结果数量}个主要颜色,返回格式为[[r,g,b],...其他颜色],以标准JSON数组格式返回,不要输出任何多余内容,不要添加任何json标准之外的符号,不要以markdown代码块形式返回` },
                    {type:"image_url",image_url:base64data}
                  ],
                  temperature:0
                },
              ]

            const body = JSON.stringify({
                messages: messages,
                model: 'gpt-4o'
            });

            fetch(模型调用基础地址 + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.siyuan.config.ai.openAI.apiKey}`
                },
                body: body
            })
                .then(response => response.json())
                .then(data => {
                    if (回调函数) {
                        try {
                            console.log(data)
                            回调函数(JSON.parse(data.choices[0].message.content.trim()));
                        } catch (e) {
                            console.warn('颜色提取回调函数错误', e, e.stack);
                        }
                    }
                })
                .catch(error => {
                    console.error('请求 GPT-4o API 时发生错误', error);
                });
        };
        reader.readAsDataURL(blob);
    });
}