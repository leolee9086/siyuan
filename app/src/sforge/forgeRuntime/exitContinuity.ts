/** 用途：复用 Forge Runtime 退出载荷的唯一 schema；使用范围：仅用于主应用收到 Kernel exit 事件时的同步边界校验；解耦评估：schema 属于同一 Forge Runtime 领域契约，通过参数再注入只会制造第二套格式实现。 */
import {forgeRuntimeExitContextSchema} from "./types";
/** 用途：约束隔离等待文档的编译期配置；使用范围：本文件内的 HTML 生成过程；解耦评估：只导入类型，不引入任何运行时实现。 */
import type {ForgeRuntimeExitContext} from "./types";

const recoveryStyles = `
:root{color-scheme:dark;font-family:Inter,Segoe UI,Microsoft YaHei,sans-serif;background:#111417;color:#e7ecef}
*{box-sizing:border-box;letter-spacing:0}
body{min-height:100vh;margin:0;display:grid;place-items:center;background:#111417}
main{width:min(560px,calc(100vw - 40px));padding:32px 0}
.mark{width:48px;height:48px;margin-bottom:24px;border:1px solid #5f6b73;display:grid;place-items:center;transform:rotate(45deg)}
.mark::after{content:"";width:16px;height:16px;border:3px double #ee7d3b}
.mark::after,.mark span{transform:rotate(-45deg)}
h1{margin:0 0 12px;font-size:24px;font-weight:650;line-height:1.35}
#phase{margin:0;color:#a9e4db;font-size:15px;line-height:1.65}
#detail{min-height:48px;margin:10px 0 0;color:#98a4ab;font-size:13px;line-height:1.65;overflow-wrap:anywhere}
.track{height:2px;margin-top:26px;background:#2e373d;overflow:hidden}
.track::after{content:"";display:block;width:34%;height:100%;background:#ee7d3b;animation:scan 1.4s ease-in-out infinite}
button{display:none;margin-top:24px;border:1px solid #7f8d95;background:#1a2024;color:#e7ecef;padding:9px 14px;font:inherit;cursor:pointer}
button:focus-visible{outline:2px solid #a9e4db;outline-offset:3px}
@keyframes scan{from{transform:translateX(-110%)}to{transform:translateX(310%)}}
@media (prefers-reduced-motion:reduce){.track::after{animation-duration:4s}}
`;

const recoveryRuntime = `
"use strict";
const config=JSON.parse(document.getElementById("recoveryConfig").textContent);
const phase=document.getElementById("phase");
const detail=document.getElementById("detail");
const resumeRollback=document.getElementById("resumeRollback");
const statusURL=new URL("/api/s-forge/forge/runtime/status",config.origin).href;
let rollbackRevision="";
const recordOutcome=(outcome,revision)=>{
    try{sessionStorage.setItem("sforge:forge-runtime-recovery",JSON.stringify({jobId:config.jobId,outcome,revision}));}
    catch(error){console.error("Forge Runtime recovery outcome could not be recorded",error);}
};
const resume=(outcome,revision)=>{
    recordOutcome(outcome,revision);
    location.replace(config.returnURL);
};
resumeRollback.addEventListener("click",()=>{
    if(rollbackRevision){resume("rolled_back",rollbackRevision);}
});
const schedule=()=>setTimeout(poll,750);
async function poll(){
    try{
        const response=await fetch(statusURL,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",credentials:"same-origin",cache:"no-store",referrerPolicy:"no-referrer"});
        if(!response.ok){throw new Error("HTTP "+response.status);}
        const payload=await response.json();
        if(payload.code!==0){throw new Error(payload.msg||"Forge Runtime status rejected");}
        const status=payload.data&&payload.data.status;
        const job=status&&status.job;
        const active=status&&status.activeVersion;
        const supervisorReady=status&&status.lifecycle==="ready"&&status.ready===true;
        if(!job||job.id!==config.jobId){
            phase.textContent="正在等待对应的切换任务";
            detail.textContent=job?"当前任务与已审批任务不匹配。":"Supervisor 尚未返回切换任务。";
            schedule();
            return;
        }
        detail.textContent="任务阶段："+(job.phase||job.state);
        if(job.state==="completed"){
            if(supervisorReady&&active&&active.state==="healthy"&&active.revision===config.targetRevision){
                phase.textContent="Kernel 校验完成，正在恢复工作区";
                resume("completed",active.revision);
                return;
            }
            phase.textContent="活动 Kernel 与已审批 revision 不匹配";
            schedule();
            return;
        }
        if(job.state==="rolled_back"){
            phase.textContent="候选 Kernel 未通过，已恢复上一健康版本";
            detail.textContent=job.error||"回退已完成。";
            if(supervisorReady&&active&&active.state==="healthy"&&active.revision){
                rollbackRevision=active.revision;
                resumeRollback.style.display="inline-block";
            }
            schedule();
            return;
        }
        if(job.state==="failed"){
            phase.textContent="Kernel 更新失败，当前页面保持隔离";
            detail.textContent=job.error||"未确认可恢复的运行版本。";
            return;
        }
        phase.textContent="正在切换 Kernel";
        schedule();
    }catch(error){
        phase.textContent="正在等待 Kernel 恢复连接";
        detail.textContent=error instanceof Error?error.message:String(error);
        schedule();
    }
}
void poll();
`;

/** 将结构化配置安全放入 HTML data block，防止 URL 中的文本终止 script 标签。 */
const serializeInlineJSON = (value: ForgeRuntimeExitContext & {origin: string, returnURL: string}) => JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");

/** 校验恢复目标仅为无用户信息与 token 查询的 HTTP(S) 页面，失败时由调用者回到 `about:blank`。 */
const requireSafeReturnURL = (value: string) => {
    if (value.length > 4096) {
        throw new Error("Forge Runtime return URL is too long");
    }
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
        throw new Error("Forge Runtime return URL must be an HTTP(S) URL without user information");
    }
    if ([...url.searchParams.keys()].some((key) => key.toLowerCase() === "token")) {
        throw new Error("Forge Runtime return URL must not contain a token query parameter");
    }
    return url;
};

/** 只识别明确声明 `forge-restart` 的载荷；普通 exit 返回 undefined，伪造载荷由 Zod 显式报错。 */
export const parseForgeRuntimeExitContext = (value: unknown) => {
    if (typeof value !== "object" || value === null || Reflect.get(value, "mode") !== "forge-restart") {
        return undefined;
    }
    return forgeRuntimeExitContextSchema.parse(value);
};

/** 使用已校验配置生成无外部资产依赖的隔离文档，以便 Kernel 停机期间仍能在浏览器内运行。 */
const createForgeRuntimeRecoveryDocument = (context: ForgeRuntimeExitContext, returnURL: string) => {
    const safeReturnURL = requireSafeReturnURL(returnURL);
    const config = serializeInlineJSON({...context, origin: safeReturnURL.origin, returnURL: safeReturnURL.href});
    return `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${safeReturnURL.origin}; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>S-Forge Kernel Update</title><style>${recoveryStyles}</style></head>
<body><main aria-live="polite"><div class="mark" aria-hidden="true"><span></span></div>
<h1>S-Forge 核心更新中</h1><p id="phase">正在等待已验证的 Kernel</p>
<p id="detail">当前应用已隔离，连接恢复后将继续。</p><div class="track" aria-hidden="true"></div>
<button id="resumeRollback" type="button">返回已验证版本</button></main>
<script id="recoveryConfig" type="application/json">${config}</script><script>${recoveryRuntime}</script>
</body></html>`;
};

/**
 * 在主 WebSocket 收到 exit 时同步构建内存导航目标，普通退出不产生 URL。
 * @同步豁免: 生命周期 - Kernel 在 exit 广播后只留出固定处理窗口，Blob 必须在当前 Document 被销毁前立即创建并导航，异步调度会让浏览器停留在持有旧 App 内存的页面中。
 */
export const createForgeRuntimeRecoveryURL = (
    value: unknown,
    returnURL: string,
    createObjectURL: (blob: Blob) => string = (blob) => URL.createObjectURL(blob),
) => {
    const context = parseForgeRuntimeExitContext(value);
    if (!context) {
        return undefined;
    }
    return createObjectURL(new Blob([createForgeRuntimeRecoveryDocument(context, returnURL)], {
        type: "text/html;charset=utf-8",
    }));
};
