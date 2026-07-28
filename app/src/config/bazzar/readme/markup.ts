/** 用途：复用 README 模板所需的同域呈现依赖；使用范围：README 侧栏模板；解耦评估：子域网关逐项直达唯一实现，不复制业务逻辑。 */
import {genFundingHTML} from "./imports";
/** 用途：读取 README 文案环境；使用范围：README 侧栏模板；解耦评估：文案由统一 i18n 所有者提供。 */
import {siyuanI18n} from "./imports";

/** 根据包类型选择 README 侧栏的导航标题。 */
const getReadmeNavTitle = (bazaarType: TBazaarType) => {
    if (bazaarType === "themes") {
        return siyuanI18n.theme;
    }
    if (bazaarType === "widgets") {
        return siyuanI18n.widget;
    }
    if (bazaarType === "templates") {
        return siyuanI18n.template;
    }
    if (bazaarType === "plugins") {
        return siyuanI18n.plugin;
    }
    return siyuanI18n.icon;
};

/** 构建 README 侧栏的身份信息、仓库地址和作者导航。 */
const buildReadmeIdentityMarkup = (data: IBazaarItem, navTitle: string, authorURL: string) => `
    <div class="fn__flex">
        <div style="padding-right: 8px" class="block__icon block__icon--show b3-tooltips b3-tooltips__e" data-type="goBack" aria-label="${siyuanI18n.back}">
            <svg><use xlink:href="#iconLeft"></use></svg>
            <span class="fn__space"></span>
            ${navTitle}
        </div>
    </div>
    <img class="item__img" src="${data.iconURL}" onerror="this.src='/stage/images/icon.png'">
    <div>
        <a href="${data.repoURL}" target="_blank" class="item__title" title="GitHub Repo">${data.preferredName}</a>
    </div>
    <div class="fn__hr"></div>
    <div>
        <a href="${data.repoURL}" target="_blank" class="ft__on-surface ft__smaller" title="GitHub Repo">${data.name}</a>
    </div>
    <div class="block__icons">
        <span class="fn__flex-1"></span>
        ${data.preferredFunding ?
            genFundingHTML(data.preferredFunding) :
            `<span class="b3-tooltips b3-tooltips__ne block__icon block__icon--show ft__primary" aria-label="${siyuanI18n.author}" style="cursor: default"><svg><use xlink:href="#iconAccount"></use></svg></span>`
        }
        <span class="fn__space"></span>
        <a href="${authorURL}" target="_blank" title="Creator">${data.author}</a>
        <span class="fn__flex-1"></span>
    </div>`;

/** 构建 README 侧栏的版本、日期、大小和安装操作。 */
const buildReadmeDetailsMarkup = (data: IBazaarItem, downloaded: boolean) => `
    <div class="fn__hr--b"></div>
    <div class="fn__hr--b"></div>
    <div class="ft__on-surface ft__smaller" style="line-height: 20px;">${siyuanI18n.currentVer}<br>v${data.version}</div>
    <div class="fn__hr"></div>
    <div class="ft__on-surface ft__smaller" style="line-height: 20px;">${downloaded ? siyuanI18n.installDate : siyuanI18n.releaseDate}<br>${downloaded ? data.hInstallDate : data.hUpdated}</div>
    <div class="fn__hr${downloaded ? " fn__none" : ""}"></div>
    <div class="ft__on-surface ft__smaller${downloaded ? " fn__none" : ""}" style="line-height: 20px;">${siyuanI18n.pkgSize}<br>${data.hSize}</div>
    <div class="fn__hr"></div>
    <div class="ft__on-surface ft__smaller" style="line-height: 20px;">${siyuanI18n.installSize}<br>${data.hInstallSize}</div>
    <div class="fn__hr--b"></div>
    <div class="fn__hr--b"></div>
    <div${(data.installed || downloaded) ? ' class="fn__none"' : ""}>
        <button class="b3-button" style="width: 168px" data-type="install">${siyuanI18n.download}</button>
    </div>
    <div${(data.outdated && (data.installed || downloaded)) ? "" : ' class="fn__none"'}>
        <button class="b3-button" style="width: 168px" data-type="install-t">${siyuanI18n.update}</button>
    </div>`;

/** 构建 README 侧栏的反馈、仓库、收藏和下载统计入口。 */
const buildReadmeActionsMarkup = (data: IBazaarItem, downloaded: boolean) => `
    <div class="fn__hr--b"></div>
    <div>
        <a href="${data.repoURL}/issues" target="_blank" title="Feedback via GitHub Issues" class="b3-button b3-button--success" style="width: 168px" data-type="feedback">${siyuanI18n.feedback}</a>
    </div>
    <div class="fn__hr--b${downloaded ? " fn__none" : ""}"></div>
    <div class="fn__hr--b${downloaded ? " fn__none" : ""}"></div>
    <div class="fn__flex${downloaded ? " fn__none" : ""}" style="justify-content: center;">
        <svg class="svg ft__on-surface fn__flex-center"><use xlink:href="#iconGithub"></use></svg>
        <span class="fn__space"></span>
        <a href="${data.repoURL}" target="_blank" title="GitHub Repo">Repo</a>
        <span class="fn__space"></span>
        <span class="fn__space"></span>
        <svg class="svg ft__on-surface fn__flex-center"><use xlink:href="#iconStar"></use></svg>
        <span class="fn__space"></span>
        <a href="${data.repoURL}/stargazers" target="_blank" title="Stars">${data.stars}</a>
        <span class="fn__space"></span>
        <span class="fn__space"></span>
        <svg class="svg ft__on-surface fn__flex-center"><use xlink:href="#iconGitHubI"></use></svg>
        <span class="fn__space"></span>
        <a href="${data.repoURL}/issues" target="_blank" title="Open issues">${data.openIssues}</a>
        <span class="fn__space"></span>
        <span class="fn__space"></span>
        <svg class="svg ft__on-surface fn__flex-center"><use xlink:href="#iconDownload"></use></svg>
        <span class="fn__space"></span>
        ${data.downloads}
    </div>
    <div class="fn__hr--b"></div>
    <div class="fn__hr--b"></div>
    <div class="fn__flex-1"></div>`;

/** 构建 README 的正文预览和 Markdown 内容容器。 */
const buildReadmeBodyMarkup = (data: IBazaarItem) => `
<div class="item__main">
    <div class="item__preview" style="background-image: url(${data.previewURL})"></div>
    <div class="b3-typography${data.preferredDesc ? "" : " fn__none"}">
        <blockquote><p>${data.preferredDesc || ""}</p></blockquote>
    </div>
    <div class="item__readme b3-typography b3-typography--default">
        <img data-type="img-loading" style="height: 64px;width: 100%;padding: 16px 0;" src="/stage/loading-pure.svg">
    </div>
</div>`;

/** 组合 README 侧栏和正文模板，保持原 DOM 层级与 data 属性。
 * @同步豁免: UI构建 - 设置页面需要在同一调用栈中生成完整 HTML。
 */
export const buildReadmeMarkup = (bazaarType: TBazaarType, data: IBazaarItem, downloaded: boolean) => {
    const authorURL = data.repoURL.split("/").slice(0, -1).join("/");
    const navTitle = getReadmeNavTitle(bazaarType);
    const dataObject = JSON.stringify({
        bazaarType,
        themeMode: data.modes?.toString(),
        name: data.name,
        repoURL: data.repoURL,
        repoHash: data.repoHash,
        downloaded,
    });
    const sidebar = `<div class="item__side" data-obj='${dataObject}'>${buildReadmeIdentityMarkup(data, navTitle, authorURL)}${buildReadmeDetailsMarkup(data, downloaded)}${buildReadmeActionsMarkup(data, downloaded)}</div>`;
    return `${sidebar}${buildReadmeBodyMarkup(data)}`;
};
