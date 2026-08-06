/**
 * 列表脏标记：详情页发生修改后标记，列表页返回时检测并刷新
 *
 * 列表页被 KeepAlive 缓存后默认不重新拉取数据；
 * 详情页对数据做过修改时调用 markListDirty(key) 登记，
 * 列表页在 onActivated 中 consumeListDirty(key) 消费一次，命中则刷新。
 */
const dirtyKeys = new Set<string>()

export function markListDirty(key: string) {
  dirtyKeys.add(key)
}

export function consumeListDirty(key: string): boolean {
  const has = dirtyKeys.has(key)
  if (has) dirtyKeys.delete(key)
  return has
}
