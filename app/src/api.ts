export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
  // Relative /api/* only: reject absolute URLs, protocol-relative and path traversal.
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('..') || path.includes('\\') || path.includes(':')) throw new ApiError('Некорректный адрес запроса.', 0);
  const verb = method || (body === undefined ? 'GET' : 'POST');
  const isWrite = verb !== 'GET' && verb !== 'HEAD';
  const response = await fetch(`/api${path}`, { method: verb, credentials: 'same-origin', headers: isWrite ? { 'Content-Type': 'application/json' } : undefined, body: isWrite ? JSON.stringify(body ?? {}) : undefined, cache: 'no-store', signal: controller.signal });
  const result = await response.json().catch(error => { if (controller.signal.aborted) throw error; return { error: 'Сервер вернул неожиданный ответ. Попробуйте ещё раз.' }; });
  if (!response.ok) { if (response.status===401 && !path.startsWith('/auth') && path!=='/me') window.dispatchEvent(new Event('session-expired')); const raw=(result as {error?:string}).error || '';
    const message=response.status===415?'Не удалось отправить данные. Обновите страницу и попробуйте снова.':response.status>=500||!raw||raw==='Internal'?'Сервер временно недоступен. Попробуйте ещё раз.':raw;
    throw new ApiError(message,response.status); }
  return result as T;
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('Сервер не ответил вовремя. Обновите страницу, чтобы проверить результат, и попробуйте ещё раз.', 408);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export const errorText = (e: unknown) => e instanceof TypeError ? 'Не удалось связаться с сервером. Проверьте соединение и повторите попытку.' : e instanceof Error ? e.message : 'Проверьте соединение и повторите попытку.';
