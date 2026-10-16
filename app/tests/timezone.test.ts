import {expect,it} from 'vitest';
import {zonedToUtc,offsetMinutes} from '../src/timezone';

// The clinic's wall clock maps to the right instant, including the zones that change offsets with daylight saving.
it('maps clinic wall-clock time to the right instant',()=>{
 expect(zonedToUtc('2026-10-19','09:00','Asia/Almaty')).toBe(Date.parse('2026-10-19T04:00:00Z'));
 expect(zonedToUtc('2026-10-19','09:00','Asia/Bishkek')).toBe(Date.parse('2026-10-19T03:00:00Z'));
 expect(zonedToUtc('2026-07-01','09:00','Europe/Berlin')).toBe(Date.parse('2026-07-01T07:00:00Z'));
 expect(zonedToUtc('2026-01-15','09:00','Europe/Berlin')).toBe(Date.parse('2026-01-15T08:00:00Z'));
 expect(offsetMinutes(Date.parse('2026-07-01T00:00:00Z'),'Europe/Berlin')).toBe(120);
});
