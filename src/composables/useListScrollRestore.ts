import { onDeactivated, nextTick } from 'vue'

/**
 * 列表页滚动位置恢复 Composable（配合 KeepAlive 缓存）
 *
 * 浏览器对 KeepAlive 缓存页不会自动恢复 window.scrollY，
 * 需要组件在失活时记录、激活时手动恢复。
 * 仅在被 KeepAlive 缓存时 onDeactivated/onActivated 才会触发；
 * 未缓存时 save 不执行、restore 回退到顶部，无副作用。
 */
export function useListScrollRestore() {
  let savedTop = 0

  onDeactivated(() => {
    savedTop = window.scrollY
  })

  async function restoreScroll() {
    await nextTick()
    window.scrollTo({ top: savedTop, behavior: 'auto' })
  }

  return { restoreScroll }
}
