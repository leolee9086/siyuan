/** 用途：复用 Forge Runtime 退出载荷校验；使用范围：Electron 热替换接续入口；解耦评估：退出身份必须与浏览器隔离页共用唯一 schema，复制解析会产生协议漂移。 */
import {parseForgeRuntimeExitContext} from "./exitContinuity";
/** 用途：管理 Electron 接续注册状态；使用范围：状态轮询、重复事件和 Model 错误边界；解耦评估：状态机必须读取同一注册槽，复制状态会破坏去重。 */
import {beginForgeRuntimeElectronRestart} from "./restartState";
/** 用途：清理 Electron 接续注册状态；使用范围：轮询终态结算；解耦评估：清理必须与开始使用同一状态所有权，不能通过事件广播替代。 */
import {endForgeRuntimeElectronRestart} from "./restartState";
/** 用途：读取 Electron 接续注册状态；使用范围：重复事件身份检查；解耦评估：同步读取全局槽是 Model 门控的唯一事实来源。 */
import {getForgeRuntimeElectronRestartState} from "./restartState";
/** 用途：登记接续 Promise；使用范围：重复事件去重和终态清理；解耦评估：Promise 身份必须绑定同一状态槽，参数传递无法覆盖重复入口。 */
import {setForgeRuntimeElectronRestartPromise} from "./restartState";
/** 用途：校验 Supervisor 状态数据；使用范围：每次状态响应的 JSON 边界；解耦评估：schema 是前后端契约唯一来源，不能在轮询函数中重复结构判断。 */
import {forgeRuntimeStatusDataSchema} from "./types";
/** 用途：识别状态响应对象；使用范围：未知 JSON 的安全读取；解耦评估：守卫集中在领域类型文件，避免各调用点自行判定对象。 */
import {isForgeRuntimeRecord} from "./types";
/** 用途：约束接续任务身份；使用范围：状态归约和开始入口；解耦评估：纯类型契约无需依赖注入。 */
import type {ForgeRuntimeElectronContinuityContext} from "./types";
/** 用途：约束可替换 Fetch 能力；使用范围：请求边界和测试注入；解耦评估：网络能力保留参数注入以隔离真实停机竞态。 */
import type {ForgeRuntimeElectronContinuityFetch} from "./types";
/** 用途：约束公开接续配置；使用范围：入口参数和默认值补齐；解耦评估：测试时钟与等待必须通过该配置注入。 */
import type {ForgeRuntimeElectronContinuityOptions} from "./types";
/** 用途：约束接续终态；使用范围：入口返回、刷新决策和错误展示；解耦评估：终态联合类型集中维护，避免调用方各自解释。 */
import type {ForgeRuntimeElectronContinuityResult} from "./types";
/** 用途：约束状态响应归约输入；使用范围：请求解析与轮询；解耦评估：纯类型契约无需运行时依赖。 */
import type {ForgeRuntimeStatusRequestResult} from "./types";
/** 用途：约束 Supervisor 状态结构；使用范围：完成和回滚健康检查；解耦评估：复用公开状态 schema 的推导类型，避免重复接口。 */
import type {ForgeRuntimeStatusData} from "./types";
/** 用途：约束轮询尝试；使用范围：状态归约和轮询循环；解耦评估：内部结果联合类型集中维护，避免业务文件定义别名。 */
import type {ForgeRuntimeElectronContinuityAttempt} from "./types";
/** 用途：约束补齐后的轮询配置；使用范围：状态请求和等待；解耦评估：配置契约集中维护，避免测试与生产各自解释默认值。 */
import type {ForgeRuntimeElectronContinuityResolvedOptions} from "./types";

const statusEndpoint = "/api/s-forge/forge/runtime/status";
const defaultIntervalMilliseconds = 750;
const defaultTimeoutMilliseconds = 90_000;
const defaultRequestTimeoutMilliseconds = 5_000;

/** 使用真实等待让 Supervisor 完成停机、启动和健康探测；测试通过参数注入等待。 */
const wait = (milliseconds: number) => new Promise<void>((resolve) => {
    // Supervisor 没有提供“下一状态已就绪”事件，只能按协议轮询间隔等待；测试通过 delay 注入替换该等待。
    globalThis.setTimeout(resolve, milliseconds);
});

/** 将未知异常转换为可展示的状态文本。 */
const describeError = (error: unknown) => error instanceof Error ? error.message : String(error);

/** 判断 HTTP 鉴权拒绝是否应停止重试，避免持续刷屏并误触发重载。 */
const isPermanentHTTPStatus = (status: number) => status === 401 || status === 403;

/** 判断 Kernel 明确拒绝主界面控制的响应是否属于永久协议错误。 */
const isPermanentControlError = (message: string) =>
    message.includes("Forge Runtime 控制") || message.includes("未运行在 Forge 模式");

/** 读取控制面返回的错误文本，保持协议错误不依赖异常对象。 */
const responseMessage = (payload: Record<string, unknown>) =>
    typeof payload.msg === "string" && payload.msg.trim() ? payload.msg : "Forge Runtime status response was rejected";

/** 为 Electron 主界面生成一次新的缓存版本，避免 reload 继续命中旧的 renderer bundle。
 * @同步豁免: 类型守卫 - URL 构造必须在导航调用前同步完成，不能把无效协议延迟到异步边界。
 * @显式返回类型原因：该 URL 工具是公开测试契约，固定 string 返回类型以约束导航边界。
 */
export const createForgeRuntimeElectronReloadURL = (currentURL: string, version: number): string => {
    const url = new URL(currentURL);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Electron main interface reload requires an HTTP(S) URL");
    }
    if (!Number.isFinite(version)) {
        throw new Error("Electron main interface reload version is invalid");
    }
    url.searchParams.set("v", String(Math.trunc(version)));
    return url.href;
};

/** 用缓存破坏后的同一主界面地址替换当前 renderer；失败时保留原生 reload 兜底。
 * @同步豁免: 生命周期 - 完成态回调必须在当前 renderer 生命周期内立即发起主界面导航。
 * @显式返回类型原因：公开导航入口固定返回 void，调用方不应把导航动作当作异步结果等待。
 */
export const reloadForgeRuntimeElectronInterface = (
    location: Pick<Location, "href" | "replace" | "reload"> = globalThis.location,
    version: number = Date.now(),
): void => {
    try {
        location.replace(createForgeRuntimeElectronReloadURL(location.href, version));
    } catch (error) {
        console.error("[Forge Runtime] Electron 主界面自动刷新失败", error);
        location.reload();
    }
};

/** 处理不可重试的 HTTP 状态；其它网络状态交给轮询退避。
 * @显式返回类型原因：401/403 必须保持 rejected 判别分支，其他状态通过异常进入 retry。
 */
const readHTTPFailure = (status: number): ForgeRuntimeStatusRequestResult => {
    const message = `Forge Runtime status HTTP ${status}`;
    if (isPermanentHTTPStatus(status)) {
        return {rejected: message};
    }
    throw new Error(message);
};

/** 解析标准 API 信封；协议不完整时抛错并由上层继续等待新 Kernel。
 * @显式返回类型原因：响应边界必须固定为 status 或 rejected，避免未知信封被当作成功状态。
 */
const parseStatusPayload = (payload: unknown): ForgeRuntimeStatusRequestResult => {
    if (!isForgeRuntimeRecord(payload)) {
        throw new Error("Forge Runtime status response is not an object");
    }
    if (payload.code === 0) {
        return {status: forgeRuntimeStatusDataSchema.parse(payload.data)};
    }
    const message = responseMessage(payload);
    if (isPermanentControlError(message)) {
        return {rejected: message};
    }
    throw new Error(message);
};

/** 请求状态时设置有限超时，防止停机窗口中的悬挂连接耗尽接续预算。
 * @显式返回类型原因：网络层只向轮询层暴露校验后的 status/rejected 判别联合。
 */
const requestStatus = async (
    fetchImpl: ForgeRuntimeElectronContinuityFetch,
    timeoutMilliseconds: number,
): Promise<ForgeRuntimeStatusRequestResult> => {
    const abortController = new AbortController();
    // 单次请求超时由停机窗口的预算确定，避免失联连接占满接续轮询；轮询仍以 Supervisor 状态为准。
    const timeout = globalThis.setTimeout(() => abortController.abort(), timeoutMilliseconds);
    try {
        const response = await fetchImpl(statusEndpoint, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: "{}",
            credentials: "same-origin",
            cache: "no-store",
            referrerPolicy: "no-referrer",
            signal: abortController.signal,
        });
        if (!response.ok) {
            return readHTTPFailure(response.status);
        }
        return parseStatusPayload(await response.json());
    } finally {
        globalThis.clearTimeout(timeout);
    }
};

/** 生成“等待对应任务”的中间状态，避免旧任务状态触发误重载。 */
const waitForMatchingJob = () => ({
    state: "retry",
    phase: "checking",
    detail: "正在等待对应的 Kernel 切换任务",
} satisfies ForgeRuntimeElectronContinuityAttempt);

/** 检查已完成任务的活动版本、健康状态和 Supervisor 就绪标志。
 * @显式返回类型原因：完成态和可重试态共享一个内部联合契约，固定返回类型供轮询归约窄化。
 */
const evaluateCompletedJob = (
    context: ForgeRuntimeElectronContinuityContext,
    status: NonNullable<ForgeRuntimeStatusData["status"]>,
): ForgeRuntimeElectronContinuityAttempt => {
    if (status.activeVersion.revision !== context.targetRevision) {
        return {state: "rejected", detail: "活动 Kernel revision 与已验证目标不匹配"};
    }
    if (status.lifecycle !== "ready" || status.ready !== true || status.activeVersion.state !== "healthy") {
        return {state: "retry", phase: "checking", detail: "正在等待活动 Kernel 健康确认"};
    }
    return {state: "completed", revision: status.activeVersion.revision};
};

/** 将一次状态响应归约为完成、失败或继续等待，集中维护所有重载前置条件。
 * @显式返回类型原因：该归约是状态机的判别联合边界，必须保留 retry 与终态的窄化信息。
 */
const evaluateStatus = (
    context: ForgeRuntimeElectronContinuityContext,
    result: ForgeRuntimeStatusRequestResult,
): ForgeRuntimeElectronContinuityAttempt => {
    if ("rejected" in result) {
        return {state: "rejected", detail: result.rejected};
    }
    if (!result.status.available) {
        return {state: "retry", phase: "waiting", detail: "Forge Runtime 尚未恢复，继续等待 Kernel"};
    }
    const status = result.status.status;
    const job = status?.job;
    if (!status || !job || job.id !== context.jobId) {
        return waitForMatchingJob();
    }
    if (job.state === "completed") {
        return evaluateCompletedJob(context, status);
    }
    /** 回滚只在 Supervisor 已就绪且原版本健康时结束接续，避免过早显示回滚结果。 */
    if (job.state === "rolled_back" &&
        (status.lifecycle !== "ready" || status.ready !== true || status.activeVersion.state !== "healthy")) {
        return {state: "retry", phase: "checking", detail: "正在等待回滚版本健康确认"};
    }
    if (job.state === "rolled_back") {
        return {
            state: "rolled_back",
            revision: status.activeVersion.revision,
            detail: job.error || "候选 Kernel 未通过健康检查，已恢复原版本",
        };
    }
    if (job.state === "failed") {
        return {state: "failed", detail: job.error || "Kernel 热替换任务失败"};
    }
    return {state: "retry", phase: "checking", detail: job.phase || job.state};
};

/** 执行一次状态检查；断连、响应不完整和停机竞态都保持可重试。
 * @显式返回类型原因：请求异常统一归约为 retry，固定联合类型供轮询循环判断。
 */
const pollAttempt = async (
    context: ForgeRuntimeElectronContinuityContext,
    options: ForgeRuntimeElectronContinuityResolvedOptions,
): Promise<ForgeRuntimeElectronContinuityAttempt> => {
    try {
        const result = await requestStatus(options.fetchImpl, options.requestTimeoutMilliseconds);
        return evaluateStatus(context, result);
    } catch (error) {
        return {state: "retry", phase: "waiting", detail: describeError(error)};
    }
};

/** 轮询 Supervisor，直到验证目标版本健康或得到明确终态。
 * @显式返回类型原因：调用方只允许消费已定义的 Electron 接续终态。
 */
const pollUntilHealthy = async (
    context: ForgeRuntimeElectronContinuityContext,
    options: ForgeRuntimeElectronContinuityResolvedOptions,
): Promise<ForgeRuntimeElectronContinuityResult> => {
    const deadline = options.now() + options.timeoutMilliseconds;
    const maxAttempts = Math.max(1, Math.ceil(options.timeoutMilliseconds / options.intervalMilliseconds));
    options.onPhase?.("waiting");
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0 && options.now() >= deadline) {
            break;
        }
        const result = await pollAttempt(context, options);
        if (result.state !== "retry") {
            return result;
        }
        options.onPhase?.(result.phase, result.detail);
        if (attempt + 1 >= maxAttempts || options.now() >= deadline) {
            break;
        }
        await options.delay(options.intervalMilliseconds);
    }
    return {state: "timed_out", detail: "等待已验证 Kernel 超时"};
};

/** 将可替换输入补齐为有限正数，避免错误配置产生无限轮询或负延迟。 */
const resolveMilliseconds = (value: number | undefined, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;

/** 补齐接续运行配置并固定单次状态请求的最大等待时间。 */
const resolveOptions = (options: ForgeRuntimeElectronContinuityOptions) => {
    const intervalMilliseconds = resolveMilliseconds(options.intervalMilliseconds, defaultIntervalMilliseconds);
    const timeoutMilliseconds = resolveMilliseconds(options.timeoutMilliseconds, defaultTimeoutMilliseconds);
    return {
        fetchImpl: options.fetchImpl || globalThis.fetch.bind(globalThis),
        delay: options.delay || wait,
        now: options.now || Date.now,
        intervalMilliseconds,
        timeoutMilliseconds,
        requestTimeoutMilliseconds: Math.min(defaultRequestTimeoutMilliseconds, timeoutMilliseconds),
        onPhase: options.onPhase,
    } satisfies ForgeRuntimeElectronContinuityResolvedOptions;
};

/** Electron 主界面独立接续 Kernel 热替换；普通退出或与当前任务冲突的迟到事件返回 undefined，完成后调用方才允许重载界面。
 * @同步豁免: 生命周期 - 必须在收到 exit 帧的当前调用栈内登记身份，先于 close/error 事件门控。
 * @显式返回类型原因：入口同时返回 undefined、共享 Promise 和拒绝终态，固定联合类型防止调用方误判普通 exit。
 */
export const startForgeRuntimeElectronContinuity = (
    value: unknown,
    options: ForgeRuntimeElectronContinuityOptions = {},
): Promise<ForgeRuntimeElectronContinuityResult> | undefined => {
    let context: ForgeRuntimeElectronContinuityContext | undefined;
    try {
        context = parseForgeRuntimeExitContext(value);
    } catch (error) {
        return Promise.resolve({state: "rejected", detail: describeError(error)});
    }
    if (!context) {
        return undefined;
    }
    const state = getForgeRuntimeElectronRestartState();
    if (state.promise && state.context?.jobId === context.jobId && state.context.targetRevision === context.targetRevision) {
        return state.promise;
    }
    if (state.promise) {
        // 另一个任务已经占有当前 Electron 主界面；迟到的旧 exit 事件不应暂停或恢复控制器。
        return undefined;
    }
    if (state.active && (state.context?.jobId !== context.jobId || state.context.targetRevision !== context.targetRevision)) {
        // active 但尚未登记 Promise 的窗口同样属于其它任务，保持当前接续状态不变。
        return undefined;
    }
    if (!state.active) {
        beginForgeRuntimeElectronRestart(context);
    }
    const resolvedOptions = resolveOptions(options);
    const promise = pollUntilHealthy(context, resolvedOptions).finally(() => {
        endForgeRuntimeElectronRestart(promise);
    });
    setForgeRuntimeElectronRestartPromise(promise);
    return promise;
};

/** 在 Model 处理原始 exit 帧时同步登记身份，先于 WebSocket 错误事件进入停机门控。
 * @同步豁免: 生命周期 - Model 的错误回调可能在下一事件任务执行，身份必须同步写入全局门控。
 */
export const prepareForgeRuntimeElectronContinuity = (value: unknown) => {
    const context = parseForgeRuntimeExitContext(value);
    if (!context) {
        return undefined;
    }
    const state = getForgeRuntimeElectronRestartState();
    if (!state.active) {
        beginForgeRuntimeElectronRestart(context);
    }
    return context;
};
