当你需要编写HTML相关内容时,注意参考以下示例中的类名和属性以及结构

这是一个按钮

```html
<button 
    class="block__icon fn__flex-center ariaLabel" 
    disabled 
    aria-label="${siyuanI18n.redo}" 
    data-type="redo">
    <svg><use xlink:href="#iconRedo"></use></svg>
</button>
```

这个是一个设置表单的label

```html
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18nn.export17}
        <div class="b3-label__text">${siyuanI18n.export18}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="addTitle" type="checkbox"${window.siyuan.config.export.addTitle ? " checked" : ""}/>
</label>
```