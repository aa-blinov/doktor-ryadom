import {afterEach,expect,it,vi} from 'vitest';
import {api,ApiError} from '../src/api';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

it('stops an unresponsive request instead of leaving the loading state pending',async()=>{
 vi.useFakeTimers();
 vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise((_resolve,reject)=>{
  options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));
 })));
 const pending=expect(api('/patient/data')).rejects.toMatchObject({status:408,message:expect.stringContaining('Сервер не ответил вовремя')});
 await vi.advanceTimersByTimeAsync(20000);await pending;
 expect(fetch).toHaveBeenCalledTimes(1);
 expect(vi.getTimerCount()).toBe(0);
});

it('clears the timeout on success and retains server errors',async()=>{
 vi.useFakeTimers();
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('{"ok":true}')).mockResolvedValueOnce(new Response('{"error":"Нет доступа"}',{status:403})));
 expect(await api('/patient/data')).toEqual({ok:true});expect(vi.getTimerCount()).toBe(0);
 await expect(api('/doctor/patients')).rejects.toEqual(new ApiError('Нет доступа',403));expect(vi.getTimerCount()).toBe(0);
});

it('also times out when response headers arrive but the body stalls',async()=>{
 vi.useFakeTimers();
 vi.stubGlobal('fetch',vi.fn((_url,options)=>Promise.resolve({
  ok:true,json:()=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))
 })));
 const pending=expect(api('/patient/data')).rejects.toMatchObject({status:408});
 await vi.advanceTimersByTimeAsync(20000);await pending;
 expect(vi.getTimerCount()).toBe(0);
});
