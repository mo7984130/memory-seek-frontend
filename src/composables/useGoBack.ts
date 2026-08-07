import { useRouter } from "vue-router";

export function useGoBack(fallback: string) {
  const router = useRouter();

  function goBack() {
    // vue-router 在 history.state 里记录 back/forward
    // back 为 null 说明没有可返回的应用内历史（如直接刷新/深链接），则回退到列表页
    if (window.history.state?.back != null) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return { goBack };
}
