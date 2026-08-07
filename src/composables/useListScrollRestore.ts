import { onBeforeRouteLeave } from "vue-router";
import { nextTick } from "vue";

/**
 * 列表页滚动位置恢复 Composable（配合 KeepAlive 缓存）
 *
 * 浏览器对 KeepAlive 缓存页不会自动恢复 window.scrollY，
 * 需要在离开时记录、激活时手动恢复。
 * 记录时机必须选在 onBeforeRouteLeave（路由导航开始、DOM 尚未变化），
 * 而非 onDeactivated：KeepAlive 会先把组件 DOM 移入隐藏容器导致
 * 文档高度塌缩，onDeactivated 里读到的 window.scrollY 已被浏览器钳制。
 */
export function useListScrollRestore() {
  let savedTop = 0;

  // 路由离开前记录真实滚动位置（此时 DOM 未被 KeepAlive 隐藏，scrollY 未被钳制）
  onBeforeRouteLeave(() => {
    savedTop = window.scrollY;
  });

  async function restoreScroll() {
    await nextTick();
    window.scrollTo({ top: savedTop, behavior: "auto" });
  }

  return { restoreScroll };
}
