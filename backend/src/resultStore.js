import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { runMigrations } from './migrations.js';

function compararResultados(a, b) {
  return b.percentage - a.percentage || b.score - a.score || a.totalTimeSeconds - b.totalTimeSeconds || Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

export class LocalResultStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.results = [];
    this.pendingWrite = Promise.resolve();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    if (fs.existsSync(filePath)) {
      const contents = fs.readFileSync(filePath, 'utf8');
      const completeContents = contents.endsWith('\n') ? contents : contents.slice(0, contents.lastIndexOf('\n') + 1);
      if (completeContents.length !== contents.length) {
        fs.truncateSync(filePath, Buffer.byteLength(completeContents));
      }
      this.results = completeContents.split('\n').filter(Boolean).map(line => JSON.parse(line));
    }
  }

  insert(result) {
    const write = this.pendingWrite.then(async () => {
      const file = await fs.promises.open(this.filePath, 'a');
      try {
        await file.writeFile(`${JSON.stringify(result)}\n`);
        await file.sync();
      } finally {
        await file.close();
      }
      this.results.push(result);
      return result;
    });
    this.pendingWrite = write.catch(() => {});
    return write;
  }

  async rankings({ className, limit }) {
    const filtered = className
      ? this.results.filter(result => normalize(result.className) === normalize(className))
      : this.results;
    return [...filtered].sort(compararResultados).slice(0, limit);
  }

  get persistence() {
    return 'file';
  }
}

export async function createPostgresStore(connectionString, ssl = false) {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString,
    ...(ssl ? { ssl: { rejectUnauthorized: false } } : {})
  });
  await runMigrations(pool);

  return {
    persistence: 'postgres',
    async insert(result) {
      const { rows } = await pool.query(
        `INSERT INTO quiz_results (id, student_name, class_name, registration_number, score, total_questions, percentage, total_time_seconds, answers, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [result.id, result.studentName, result.className, result.registrationNumber, result.score, result.totalQuestions, result.percentage, result.totalTimeSeconds, JSON.stringify(result.answers), result.createdAt]
      );
      return mapPostgresResult(rows[0]);
    },
    async rankings({ className, limit }) {
      const values = className ? [className, limit] : [limit];
      const classFilter = className ? 'WHERE lower(class_name) = lower($1)' : '';
      const limitParameter = className ? '$2' : '$1';
      const { rows } = await pool.query(
        `SELECT * FROM quiz_results ${classFilter}
         ORDER BY percentage DESC, score DESC, total_time_seconds ASC, created_at ASC
         LIMIT ${limitParameter}`,
        values
      );
      return rows.map(mapPostgresResult);
    },
    close: () => pool.end()
  };
}

function mapPostgresResult(row) {
  return {
    id: row.id,
    studentName: row.student_name,
    name: row.student_name,
    className: row.class_name,
    registrationNumber: row.registration_number,
    score: row.score,
    totalQuestions: row.total_questions,
    percentage: row.percentage,
    totalTimeSeconds: row.total_time_seconds,
    answers: row.answers,
    createdAt: new Date(row.created_at).toISOString()
  };
}

function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function createResult(input) {
  const studentName = String(input.studentName || input.name || '').trim();
  const className = String(input.className || input.turma || '').trim();
  const registrationNumber = String(input.registrationNumber || input.matricula || '').trim();
  const score = Number(input.score ?? input.acertos);
  const totalQuestions = Number(input.totalQuestions ?? input.total);
  const totalTimeSeconds = Number(input.totalTimeSeconds ?? input.tempoSegundos ?? 0);
  const createdAt = input.createdAt || new Date().toISOString();

  if (!studentName || studentName.length > 120 || !className || className.length > 40 || !registrationNumber || registrationNumber.length > 40) {
    throw Object.assign(new Error('Nome, turma ou matrícula inválidos.'), { status: 400 });
  }
  if (!Number.isInteger(score) || !Number.isInteger(totalQuestions) || totalQuestions < 1 || totalQuestions > 200 || score < 0 || score > totalQuestions) {
    throw Object.assign(new Error('Pontuação ou quantidade de questões inválida.'), { status: 400 });
  }
  if (!Number.isFinite(totalTimeSeconds) || totalTimeSeconds < 0 || totalTimeSeconds > 86400) {
    throw Object.assign(new Error('Tempo total inválido.'), { status: 400 });
  }
  if (!Number.isFinite(Date.parse(createdAt))) {
    throw Object.assign(new Error('Data do resultado inválida.'), { status: 400 });
  }
  if (input.answers !== undefined && (!Array.isArray(input.answers) || input.answers.length > 200)) {
    throw Object.assign(new Error('Lista de respostas inválida.'), { status: 400 });
  }

  return {
    id: randomUUID(),
    studentName,
    name: studentName,
    className,
    registrationNumber,
    score,
    totalQuestions,
    percentage: Math.round((score / totalQuestions) * 100),
    totalTimeSeconds,
    answers: input.answers || [],
    createdAt: new Date(createdAt).toISOString()
  };
}
