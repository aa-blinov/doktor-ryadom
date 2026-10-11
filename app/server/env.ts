export type MailMessage = {to:string;subject:string;text:string};
export type Env = {DB:D1Database;ASSETS:Fetcher;MAIL?:{send:(message:MailMessage)=>Promise<void>};PUSH_PUBLIC_KEY?:string;PUSH_SEND?:(subscription:{endpoint:string;keys:{p256dh:string;auth:string}},body:string,url?:string)=>Promise<void>};
