## 用途

便利挂件获取数据

## 原理

通过DOM属性判断自己是不是在思源的挂件环境中,然后决定是从URL还是DOM获取必要的数据.

当在挂件环境中时,网页实际上是通过一个iframe加载的,这个特殊的iframe节点被称为挂件块.

它实际上和其它iframe没有本质区别,唯一特殊的可能是由于同源性可以通过window.parent访问所在的软件界面.

这个块的DOM结构类似:

```html
<div data-node-id="20251115132345-g0y5qt1" data-node-index="1" data-type="NodeWidget" class="iframe" updated="20251115132345" data-subtype="widget"><div class="iframe-content"><iframe src="/widgets/digital-clock/" data-subtype="widget" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe><span class="protyle-action__drag" contenteditable="false"></span></div><div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div>
```

此时可以通过

```javascript
const parent = window.parent
```
来获取父窗口

然后通过最直接的方式,以DOM查询获取包含iframe的父元素，然后读取其`data-node-id`属性：

```javascript
function getBlockId() {
    // 获取当前iframe元素
    const currentIframe = window.frameElement;
    
    if (!currentIframe) {
        console.error('无法获取当前iframe元素');
        return null;
    }
    
    // 获取包含iframe的挂件块元素
    const widgetBlock = currentIframe.closest('[data-node-id]');
    
    if (!widgetBlock) {
        console.error('无法找到挂件块元素');
        return null;
    }
    
    // 返回块ID
    return widgetBlock.getAttribute('data-node-id');
}

// 使用示例
const blockId = getBlockId();
console.log('当前挂件块ID:', blockId);
```

获取了块ID之后,我们就可以通过后端的接口直接访问数据了,这个部分可以参考kernelSDK\packages\apiDefs中的定义,这个做法使是因为我是自用,如果你需要发布到集市(并不建议普通用户把自己制作的小挂件向集市发布,这并不是单纯只有乐趣和收获的一件事),最好只使用公开的api.

我**不是**思源笔记社区的成员,只是经常使用所以需要了解一些开发接口,更完整的接口定义可以参考思源社区维护的社区文档
https://app.apifox.com/project/4484310/apis/api-315076016