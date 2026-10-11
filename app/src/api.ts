export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
  const url = path.startsWith('/') ? `/api${path}` : `/api/${path}`;
  const response = await fetch(url, { method: method || (body === undefined ? 'GET' : 'POST'), credentials: 'same-origin', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: controller.signal });
  const result = await response.json().catch(error => { if (controller.signal.aborted) throw error; return { error: 'Сервер вернул неожиданный ответ. Попробуйте ещё раз.' }; });
  if (!response.ok) { if (response.status===401 && !path.startsWith('/auth') && path!=='/me') window.dispatchEvent(new Event('session-expired')); throw new ApiError((result as {error?:string}).error || 'Не удалось выполнить запрос.',response.status); }
  return result as T;
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('Сервер не ответил вовремя. Обновите страницу, чтобы проверить результат, и попробуйте ещё раз.', 408);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export const errorText = (e: unknown) => e instanceof TypeError ? 'Не удалось связаться с сервером. Проверьте соединение и повторите попытку.' : e instanceof Error ? e.message : 'Проверьте соединение и повторите попытку.';
