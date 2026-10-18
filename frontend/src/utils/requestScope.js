export const isCanceled = error => error?.name === 'AbortError' || error?.code === 'ERR_CANCELED';
export function createRequestScope() {
  let active;
  return {
    start() {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      const current = () => active === controller && !controller.signal.aborted;
      return { signal: controller.signal, current, check: () => {
        if (!current()) throw new DOMException('Solicitud obsoleta cancelada', 'AbortError');
      } };
    },
    cancel() { active?.abort(); active = undefined; },
  };
}
