#!/usr/bin/env node
/**
 * Fills doctor profiles with realistic demo content and renames leftover QA accounts.
 * Safe to re-run. Target: the live SQLite file (default /data/ryadom.sqlite).
 */
import { DatabaseSync } from 'node:sqlite';

const path = process.env.DATABASE_PATH || '/data/ryadom.sqlite';
const db = new DatabaseSync(path);
const now = Date.now();

const profiles = {
  'Жауков Абат Бекболатович': {
    specialty: 'Врач-психиатр',
    clinic: 'Кабинет врача Жаукова, центр Insait, Астана',
    address: 'г. Астана, улица Кабанбай батыра, 59Б',
    about: 'Я Абат Бекболатович Жауков, психиатр и психотерапевт. Мой стаж — 23 года. Работаю с депрессией, тревогой, паническими атаками и другими психическими расстройствами. Также консультирую по вопросам семейных отношений. Принимаю в Астане, в центре психологии и гипнотерапии Insait.',
    focusAreas: 'Семейные отношения\nДепрессия\nТревоги\nПанические атаки\nБиполярные расстройства\nПсихозы\nНеврозы\nПсихотравмы\nПсихосоматические расстройства\nСДВГ\nДеменция\nБоли в теле на фоне стресса',
    experienceYears: 23,
  },
  'Демо Врач': {
    specialty: 'Психиатрия',
    clinic: 'Медицинский центр «Аруна», Алматы',
    address: 'г. Алматы, проспект Абая, 44, 3 этаж',
    about: 'Психиатр, консультирую взрослых при тревоге, депрессии и нарушениях сна. Подбираю терапию и веду пациента между приёмами. Приём по записи.',
    focusAreas: 'Тревожные расстройства\nДепрессия\nНарушения сна',
    experienceYears: 12,
  },
  'Демо Психолог': {
    specialty: 'Клинический психолог',
    clinic: 'Кабинет «Опора», Алматы',
    address: 'г. Алматы, улица Сатпаева, 90/1',
    about: 'Помогаю справляться с тревогой и выгоранием через разговор и практики внимания. Работаю бережно, в вашем темпе.',
    focusAreas: 'Тревога\nВыгорание\nСамооценка',
    experienceYears: 7,
  },
  'Демо Психотерапевт': {
    specialty: 'Психотерапевт, КПТ',
    clinic: 'Клиника «Диалог», Астана',
    address: 'г. Астана, улица Кунаева, 21',
    about: 'Когнитивно-поведенческая терапия при тревожных расстройствах и депрессии. Приём онлайн и очно.',
    focusAreas: 'КПТ\nПанические атаки\nДепрессия',
    experienceYears: 15,
  },
  'Демо Врач Заявка': {
    specialty: 'Психотерапия',
    clinic: 'Частная практика, Алматы',
    address: 'г. Алматы, улица Гоголя, 15',
    about: 'Психотерапевт, работаю с эмоциональным выгоранием и тревогой у взрослых.',
    focusAreas: 'Тревога\nВыгорание\nОтношения',
    experienceYears: 9,
  },
};

const renames = {
  'Тест Приглашения': 'Айгерим Ниязова',
  'Тест Каталога': 'Сергей Ким',
  'QA Fresh Patient': 'Алия Оспанова',
  'Тестовый Пациент': 'Марат Ержанов',
  'QAReuse': 'Дина Ахметова',
  'QAReuse2': 'Арман Сагиндыков',
  'QAPatient': 'Лаура Тлеуова',
  'Тестов patient-out': 'Наталья Пак',
  'Тестов admin-tpat': 'Олег Ким',
  'Тестов doctor-out': 'Ирина Ли',
  'Тестов admin-tdoc': 'Павел Морозов',
  'Мария Тестова': 'Мария Саидова',
  'Данияр Тестов': 'Данияр Оспанов',
};

for (const [name, patch] of Object.entries(profiles)) {
  const user = db.prepare('SELECT id FROM users WHERE name=? AND role=?').get(name, 'doctor');
  if (!user) continue;
  const row = db.prepare('SELECT data FROM profiles WHERE user_id=?').get(user.id);
  const data = row ? JSON.parse(row.data) : {};
  Object.assign(data, patch);
  db.prepare(
    'INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',
  ).run(user.id, JSON.stringify(data), now);
  console.log('profile', name);
}

for (const [from, to] of Object.entries(renames)) {
  const r = db.prepare('UPDATE users SET name=? WHERE name=?').run(to, from);
  if (r.changes) console.log('rename', from, '→', to);
}

for (const n of db.prepare("SELECT id FROM checkins WHERE note LIKE '%QA %' OR note LIKE '%test note%'").all()) {
  db.prepare('UPDATE checkins SET note=? WHERE id=?').run('', n.id);
  console.log('cleared note', n.id);
}

db.close();
