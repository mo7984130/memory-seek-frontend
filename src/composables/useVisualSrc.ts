import { computed, onBeforeUnmount, ref, watch } from "vue";
import { visual as visualApi } from "memory-seek-api";

/** 媒体类型：图片 / 视频 */
export type VisualMediaType = "image" | "video";

/**
 * 媒体源状态：
 * - `idle`        无 token
 * - `loading`     已渲染，等待媒体元素加载完成
 * - `transcoding` 媒体元素加载失败且服务端返回 202（衍生物转码中），延迟重试
 * - `ready`       已加载完成
 * - `error`       加载失败（404 / 网络错误 / 超过重试上限）
 */
export type VisualSrcStatus =
  | "idle"
  | "loading"
  | "transcoding"
  | "ready"
  | "error";

export interface UseVisualSrcOptions {
  /** 响应式 token 来源；返回空表示无媒体 */
  token: () => string | null | undefined;
  /** 媒体类型（图片 / 视频） */
  type: () => VisualMediaType;
  /**
   * 是否可以异步转码（视频缩略片 / 预览片）。
   * 图片与视频原片不会返回 202，加载失败时直接判失败、不做探测。
   */
  waitForTranscode?: () => boolean;
  /** 未拿到 `Retry-After` 时的轮询间隔兜底值（毫秒） */
  retryIntervalMs?: number;
}

/** 服务端未返回 `Retry-After` 时使用的默认轮询间隔 */
const DEFAULT_RETRY_MS = 3000;
/** 「源可访问但元素报错」时短暂延迟后原样重载 */
const RELOAD_DELAY_MS = 1000;
/** 转码中最多重试次数（按 3s 间隔约 3 分钟），超过则视为失败 */
const MAX_ATTEMPTS = 60;

interface ProbeResult {
  state: "ready" | "transcoding" | "error";
  retryAfterMs?: number;
}

/**
 * 影像媒体源 Composable
 *
 * 直接渲染 token URL（正常情况只发一次请求），仅当媒体元素加载失败时，
 * 才对「可能异步转码」的视频缩略片 / 预览片做 `HEAD` 探测来区分：
 * - `202`：衍生物转码中，按 `Retry-After` 延迟后换地址重载；
 * - 其它：视为失败。
 *
 * `HEAD` 只会拿到状态码（服务端会去掉响应体，不会真正下载影像），
 * 且不附带自定义请求头，避免触发 CORS 预检。
 */
export function useVisualSrc(options: UseVisualSrcOptions) {
  const src = ref<string | null>(null);
  const status = ref<VisualSrcStatus>("idle");
  const isVideo = computed(() => options.type() === "video");
  const retryIntervalMs = options.retryIntervalMs ?? DEFAULT_RETRY_MS;

  let baseUrl: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let attempts = 0;
  // 探测/重试请求序号：附加到 URL 以绕开缓存并强制元素重新加载
  let seq = 0;
  let busy = false;
  // 每次 load 递增，用于丢弃过期的异步结果
  let runId = 0;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** 中止探测与重试（切换影像 / 卸载时调用） */
  function stop() {
    clearTimer();
    controller?.abort();
    controller = null;
    runId += 1;
  }

  function withSeq(url: string, flag: string) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${flag}=${++seq}`;
  }

  async function probe(url: string): Promise<ProbeResult> {
    const ctrl = new AbortController();
    controller = ctrl;
    try {
      const res = await fetch(withSeq(url, "_probe"), {
        method: "HEAD",
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return { state: "error" };
      if (res.status === 202) {
        const retryAfter = Number(res.headers.get("Retry-After"));
        return {
          state: "transcoding",
          retryAfterMs:
            Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : retryIntervalMs,
        };
      }
      return { state: res.ok ? "ready" : "error" };
    } catch (error) {
      if (ctrl.signal.aborted) return { state: "error" };
      console.error("[useVisualSrc] 探测影像源失败:", error);
      return { state: "error" };
    } finally {
      if (controller === ctrl) controller = null;
    }
  }

  function scheduleRetry(delay: number) {
    clearTimer();
    timer = setTimeout(() => {
      const url = baseUrl;
      if (!url) return;
      src.value = withSeq(url, "_retry");
      status.value = "loading";
    }, delay);
  }

  /** 媒体元素加载失败（`@error`）：探测分类并决定是否重试 */
  async function handleError() {
    if (busy || !baseUrl || !src.value) return;
    if (status.value === "error") return;

    // 图片 / 视频原片不涉及异步转码，直接判失败
    if (!options.waitForTranscode?.()) {
      status.value = "error";
      return;
    }

    busy = true;
    const id = runId;
    const result = await probe(baseUrl);
    busy = false;
    if (id !== runId) return;

    if (result.state === "error") {
      status.value = "error";
      return;
    }

    attempts += 1;
    if (attempts >= MAX_ATTEMPTS) {
      status.value = "error";
      return;
    }

    if (result.state === "transcoding") {
      status.value = "transcoding";
      scheduleRetry(result.retryAfterMs ?? retryIntervalMs);
      return;
    }

    // 源可访问但元素报错（多为偶发），短暂延迟后原样重载
    scheduleRetry(RELOAD_DELAY_MS);
  }

  /** 媒体元素加载成功（`@load` / `@loadedmetadata`） */
  function handleLoaded() {
    if (status.value === "error") return;
    clearTimer();
    attempts = 0;
    status.value = "ready";
  }

  function load() {
    stop();
    attempts = 0;
    baseUrl = null;

    const token = options.token();
    if (!token) {
      src.value = null;
      status.value = "idle";
      return;
    }

    baseUrl = visualApi.getVisualUrl(token);
    src.value = baseUrl;
    // 视频缩略片 / 预览片可能仍在转码，先按加载中处理
    status.value = options.waitForTranscode?.() ? "loading" : "ready";
  }

  const key = computed(
    () =>
      `${options.token() ?? ""}|${options.type()}|${
        options.waitForTranscode?.() ? 1 : 0
      }`,
  );

  watch(key, load, { immediate: true });
  onBeforeUnmount(stop);

  return { src, status, isVideo, handleLoaded, handleError };
}
