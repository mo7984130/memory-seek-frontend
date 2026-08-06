import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { photo } from 'memory-seek-api'
import type { Person } from 'memory-seek-api'

const PAGE_SIZE = 32
const LOAD_THRESHOLD = 80

export interface UsePersonSearchOptions {
  /** 需要从结果中排除的人物 id（如合并弹窗排除当前人物） */
  excludeId?: () => string | null | undefined
}

/**
 * 人物分页搜索 Composable
 *
 * 供弹窗内"搜索/选择人物"场景复用（合并人物、修改人脸归属等）：
 * - 有关键词走 person search API，否则走列表 API（均游标分页，按需加载，不全量拉取）
 * - 关键词变化防抖后重置并重新加载第一页
 * - 列表滚动触底时加载下一页
 */
export function usePersonSearch(options: UsePersonSearchOptions = {}) {
  const keyword = ref('')
  const persons = ref<Person[]>([])
  const cursor = ref<string | null>(null)
  const hasMore = ref(true)
  const loading = ref(false)
  const loaded = ref(false)

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    loading.value = true
    try {
      const kw = keyword.value.trim()
      const res = kw
        ? await photo.person.searchPersons(kw, { cursor: cursor.value, size: PAGE_SIZE })
        : await photo.person.getPersons({ cursor: cursor.value, size: PAGE_SIZE })
      const page = res.data
      const exclude = options.excludeId?.()
      const records = exclude ? page.records.filter((p) => p.id !== exclude) : page.records
      persons.value.push(...records)
      cursor.value = page.nextCursor
      hasMore.value = page.hasMore
    } catch (error) {
      console.error('[usePersonSearch] 加载人物列表失败:', error)
    } finally {
      loading.value = false
    }
  }

  /** 重置列表并加载第一页（打开弹窗 / 关键词变化时调用） */
  function reload() {
    persons.value = []
    cursor.value = null
    hasMore.value = true
    loaded.value = true
    loadMore()
  }

  /** 清空状态（关闭弹窗时调用） */
  function reset() {
    keyword.value = ''
    persons.value = []
    cursor.value = null
    hasMore.value = true
    loading.value = false
    loaded.value = false
  }

  const onKeywordChange = useDebounceFn(reload, 300)
  watch(keyword, () => {
    onKeywordChange()
  })

  /** 滚动容器触底时加载下一页 */
  function onScroll(event: Event) {
    const el = event.currentTarget as HTMLElement
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - LOAD_THRESHOLD) {
      loadMore()
    }
  }

  return { keyword, persons, hasMore, loading, loaded, loadMore, reload, reset, onScroll }
}
