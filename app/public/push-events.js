function notificationTarget(value){
 try{const target=new URL(value||'/#/today',self.location.origin);if(target.origin===self.location.origin&&['/#/today','/#/patients'].includes(target.pathname+target.hash))return target.href;}catch{}
 return new URL('/#/today',self.location.origin).href;
}
self.addEventListener('push',event=>{
 let payload={title:'Рядом',body:'В вашем кабинете есть обновления.',url:'/#/today'};
 try{if(event.data){const incoming=event.data.json();if(incoming&&typeof incoming==='object')payload={...payload,...incoming};}}catch{}
 event.waitUntil(self.registration.showNotification(typeof payload.title==='string'?payload.title.slice(0,80):'Рядом',{body:typeof payload.body==='string'?payload.body.slice(0,500):'В вашем кабинете есть обновления.',icon:'/icon-192.png',badge:'/icon-192.png',tag:'ryadom-update',data:{url:notificationTarget(payload.url)}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{const target=notificationTarget(event.notification.data?.url),windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=windows.find(c=>new URL(c.url).origin===self.location.origin);if(client){await client.navigate(target);await client.focus();return;}await self.clients.openWindow(target);})());
});
