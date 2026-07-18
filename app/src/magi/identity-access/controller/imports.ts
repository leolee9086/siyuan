/** 用途：Vue 响应式和生命周期；使用范围：Identity Access 控制器；解耦评估：视图状态依赖 Vue。 */
import { computed, onBeforeUnmount, onMounted, proxyRefs, reactive, ref } from "vue";
/** 用途：身份会话类型；使用范围：表单、列表和渠道字段；解耦评估：身份服务公开契约。 */
import type {
    MagiChannelBinding,
    MagiIdentityStats,
    MagiIdentityView,
    MagiRequestChannel,
} from "../../service/magiIdentitySession";
/** 用途：身份会话服务；使用范围：Identity Access 读写动作；解耦评估：网络和共享会话集中在服务层。 */
import {
    clearActiveMagiArmorSession,
    fetchMagiIdentityStats,
    issueAvatarToken,
    issueChannelBindCode,
    loginMagiIdentity,
    MAGI_IDENTITY_REQUIRED_EVENT,
    refreshMagiIdentities,
    removeMagiIdentity,
    upsertMagiIdentity,
    useMagiIdentitySessionState,
} from "../../service/magiIdentitySession";

/** controller 域的 computed。 */
export { computed };
/** controller 域的卸载生命周期。 */
export { onBeforeUnmount };
/** controller 域的挂载生命周期。 */
export { onMounted };
/** controller 域的视图 ref 解包能力。 */
export { proxyRefs };
/** controller 域的 reactive。 */
export { reactive };
/** controller 域的 ref。 */
export { ref };
/** controller 域的渠道绑定类型。 */
export type { MagiChannelBinding };
/** controller 域的统计类型。 */
export type { MagiIdentityStats };
/** controller 域的身份视图类型。 */
export type { MagiIdentityView };
/** controller 域的请求渠道类型。 */
export type { MagiRequestChannel };
/** controller 域的会话清除能力。 */
export { clearActiveMagiArmorSession };
/** controller 域的统计读取能力。 */
export { fetchMagiIdentityStats };
/** controller 域的 Avatar token 签发能力。 */
export { issueAvatarToken };
/** controller 域的渠道绑定码签发能力。 */
export { issueChannelBindCode };
/** controller 域的身份登录能力。 */
export { loginMagiIdentity };
/** controller 域的登录请求事件。 */
export { MAGI_IDENTITY_REQUIRED_EVENT };
/** controller 域的身份列表刷新能力。 */
export { refreshMagiIdentities };
/** controller 域的身份删除能力。 */
export { removeMagiIdentity };
/** controller 域的身份保存能力。 */
export { upsertMagiIdentity };
/** controller 域的共享会话状态。 */
export { useMagiIdentitySessionState };
