export function database(env: { DB: D1Database }) { if (!env.DB) throw new Error('Database binding unavailable'); return env.DB; }
export const one = <T>(db: D1Database, sql: string, ...values: (string | number | null)[]) => db.prepare(sql).bind(...values).first<T>();
export async function many<T>(db: D1Database, sql: string, ...values: (string | number | null)[]) { return (await db.prepare(sql).bind(...values).all<T>()).results; }
export const run = (db: D1Database, sql: string, ...values: (string | number | null)[]) => db.prepare(sql).bind(...values).run();
export const logAction = (db: D1Database, actor: string, action: string, subject: string) => run(db, 'INSERT INTO audit (id,actor_id,action,subject_id,created_at) VALUES (?,?,?,?,?)', crypto.randomUUID(), actor, action, subject, Date.now());
