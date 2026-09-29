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
    this.pendingStudentWrite = Promise.resolve();
    this.studentsFile = `${filePath}.students.json`;
    this.students = new Map();
    this.studentNames = new Map();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    if (fs.existsSync(this.studentsFile)) {
      for (const student of JSON.parse(fs.readFileSync(this.studentsFile, 'utf8'))) {
        this.students.set(student.deviceId, student);
        this.studentNames.set(normalize(student.studentName), student.deviceId);
      }
    }

    if (fs.existsSync(filePath)) {
      const contents = fs.readFileSync(filePath, 'utf8');
      const completeContents = contents.endsWith('\n') ? contents : contents.slice(0, contents.lastIndexOf('\n') + 1);
      if (completeContents.length !== contents.length) {
        fs.truncateSync(filePath, Buffer.byteLength(completeContents));
      }
      this.results = completeContents.split('\n').filter(Boolean).map(line => JSON.parse(line));
    }

    for (const result of this.results) {
      if (!this.students.has(result.deviceId) && !this.studentNames.has(normalize(result.studentName))) {
        const student = {
          id: result.studentId || randomUUID(),
          deviceId: result.deviceId || `legacy:${normalize(result.studentName)}`,
          studentName: result.studentName,
          className: result.className,
          registrationNumber: result.registrationNumber
        };
        this.students.set(student.deviceId, student);
        this.studentNames.set(normalize(student.studentName), student.deviceId);
      }
    }
    for (const result of this.results) {
      const student = this.students.get(result.deviceId) || this.students.get(this.studentNames.get(normalize(result.studentName)));
      if (student) {
        result.studentId = student.id;
        result.deviceId = student.deviceId;
      }
    }
  }

  registerStudent(input) {
    const registration = this.pendingStudentWrite.then(() => this.persistStudent(input));
    this.pendingStudentWrite = registration.catch(() => {});
    return registration;
  }

  persistStudent(input) {
    const nameKey = normalize(input.studentName);
    const current = this.students.get(input.deviceId);
    const currentNameOwner = this.studentNames.get(normalize(current?.studentName || ''));
    if (current && currentNameOwner && currentNameOwner !== input.deviceId) {
      throw Object.assign(new Error('Esse dispositivo está associado a outro cadastro. Reutilize seu cadastro existente.'), { status: 409 });
    }
      let namedDevice = this.studentNames.get(nameKey);
      let namedStudent = namedDevice ? this.students.get(namedDevice) : null;
    if (current && namedStudent && current.id !== namedStudent.id) {
      throw Object.assign(new Error('Esse nome já pertence a outro aluno. Use o cadastro existente ou escolha outro nome.'), { status: 409 });
    }
      if (!namedStudent && namedDevice) {
        const legacyResult = this.results.find(result => normalize(result.studentName) === nameKey);
        namedStudent = {
          id: legacyResult?.studentId || randomUUID(),
          deviceId: namedDevice,
          studentName: legacyResult?.studentName || input.studentName,
          className: legacyResult?.className || input.className,
          registrationNumber: legacyResult?.registrationNumber || input.registrationNumber
        };
      this.students.set(namedDevice, namedStudent);
      for (const result of this.results) {
        if (normalize(result.studentName) === nameKey) {
          result.studentId = namedStudent.id;
          result.deviceId = namedStudent.deviceId;
        }
      }
    }
    if (namedStudent && namedStudent.deviceId !== input.deviceId && normalize(namedStudent.registrationNumber) !== normalize(input.registrationNumber)) {
      throw Object.assign(new Error('Esse nome já está cadastrado em outro dispositivo. Use o cadastro existente ou escolha outro nome.'), { status: 409 });
    }
    const existing = current || namedStudent;
    if (current && namedStudent && current.id !== namedStudent.id) {
      throw Object.assign(new Error('Esse nome já pertence a outro aluno neste dispositivo. Use o cadastro existente.'), { status: 409 });
    }

    const student = {
      id: existing?.id || randomUUID(),
      deviceId: input.deviceId,
      studentName: input.studentName,
      className: input.className,
      registrationNumber: input.registrationNumber
    };
    if (existing) {
      this.students.delete(existing.deviceId);
      this.studentNames.delete(normalize(existing.studentName));
    }
    for (const result of this.results) {
      if (result.studentId === student.id || normalize(result.studentName) === nameKey) {
        result.studentId = student.id;
        result.deviceId = student.deviceId;
        result.studentName = student.studentName;
        result.name = student.studentName;
        result.className = student.className;
        result.registrationNumber = student.registrationNumber;
      }
    }
    const resultsTemporaryFile = `${this.filePath}.tmp`;
    fs.writeFileSync(resultsTemporaryFile, this.results.map(result => JSON.stringify(result)).join('\n') + (this.results.length ? '\n' : ''));
    fs.renameSync(resultsTemporaryFile, this.filePath);
    this.students.set(student.deviceId, student);
    this.studentNames.set(nameKey, student.deviceId);
    const temporaryFile = `${this.studentsFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify([...this.students.values()]));
    fs.renameSync(temporaryFile, this.studentsFile);
    return student;
  }

  insert(result) {
    const write = this.pendingWrite.then(async () => {
      const existing = this.results.find(item => item.idempotencyKey === result.idempotencyKey);
      if (existing) {
        const sameAttempt = ['studentId', 'score', 'totalQuestions', 'percentage', 'totalTimeSeconds']
          .every(key => existing[key] === result[key]) && JSON.stringify(existing.answers) === JSON.stringify(result.answers);
        if (!sameAttempt) throw Object.assign(new Error('A chave de idempotência já foi usada para outro resultado.'), { status: 409 });
        return existing;
      }
      const student = this.students.get(result.deviceId);
      if (!student || student.id !== result.studentId) {
        throw Object.assign(new Error('Cadastro do aluno não encontrado. Atualize o cadastro antes de enviar o resultado.'), { status: 409 });
      }
      result = {
        ...result,
        studentName: student.studentName,
        name: student.studentName,
        className: student.className,
        registrationNumber: student.registrationNumber
      };
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
    const bestByStudent = new Map();
    const allStudents = [...this.students.values()];
    for (const result of this.results) {
      if (allStudents.some(student => student.id === result.studentId || normalize(student.studentName) === normalize(result.studentName))) continue;
      const student = {
        id: result.studentId || `legacy:${normalize(result.studentName)}`,
        deviceId: result.deviceId || `legacy:${normalize(result.studentName)}`,
        studentName: result.studentName,
        className: result.className,
        registrationNumber: result.registrationNumber
      };
      allStudents.push(student);
    }
    for (const student of allStudents) {
      if (className && normalize(student.className) !== normalize(className)) continue;
      const best = this.results.filter(result =>
        result.studentId === student.id || normalize(result.studentName) === normalize(student.studentName)
      ).reduce((currentBest, result) => (
        !currentBest || compararResultados(result, currentBest) < 0 ? result : currentBest
      ), null);
      if (best) bestByStudent.set(student.id, {
        ...best,
        studentId: student.id,
        deviceId: student.deviceId,
        studentName: student.studentName,
        name: student.studentName,
        className: student.className,
        registrationNumber: student.registrationNumber
      });
    }
    return [...bestByStudent.values()].sort(compararResultados).slice(0, limit);
  }

  get persistence() {
    return 'file';
  }
}

export async function createPostgresStore(connectionString, ssl = false) {
  const { Pool } = await import('pg');
  const max = Number(process.env.PGPOOL_MAX || 5);
  if (!Number.isInteger(max) || max < 1 || max > 50) throw new Error('PGPOOL_MAX deve ser um inteiro entre 1 e 50.');
  const pool = new Pool({
    connectionString,
    max,
    ...(ssl ? { ssl: { rejectUnauthorized: false } } : {})
  });
  pool.on('error', error => console.error(JSON.stringify({ type: 'postgres_pool_error', message: error.message })));
  await runMigrations(pool);

  return {
    persistence: 'postgres',
    get poolStats() {
      return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max };
    },
    async registerStudent(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const nameKey = input.nameKey;
        const lockStartedAt = performance.now();
        const lockKeys = [...new Set([`device:${input.deviceId}`, `name:${nameKey}`])].sort();
        for (const key of lockKeys) {
          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 721904282))', [key]);
        }
        console.log(JSON.stringify({ type: 'student_registration_lock', waitMs: Math.round((performance.now() - lockStartedAt) * 100) / 100 }));
        const own = await client.query('SELECT * FROM student_profiles WHERE device_id = $1 FOR UPDATE', [input.deviceId]);
        const named = await client.query('SELECT * FROM student_profiles WHERE name_key = $1 FOR UPDATE', [nameKey]);
        if (own.rowCount && named.rowCount && own.rows[0].id !== named.rows[0].id) {
          throw Object.assign(new Error('Esse dispositivo já está vinculado a outro aluno. Atualize a página para usar o cadastro já salvo.'), { status: 409 });
        }
        if (named.rowCount && named.rows[0].device_id && named.rows[0].device_id !== input.deviceId) {
          if (normalize(named.rows[0].registration_number) !== normalize(input.registrationNumber)) {
            throw Object.assign(new Error('Esse nome já está cadastrado em outro dispositivo. Use o cadastro existente ou escolha outro nome.'), { status: 409 });
          }
          const recovered = await client.query(
            `UPDATE student_profiles SET device_id = $2, class_name = $3, registration_number = $4, updated_at = now()
             WHERE id = $1
             RETURNING id, device_id, student_name, class_name, registration_number`,
            [named.rows[0].id, input.deviceId, input.className, input.registrationNumber]
          );
          if (recovered.rowCount) {
            await client.query('COMMIT');
            return mapStudent(recovered.rows[0]);
          }
        }
        const current = own.rowCount ? own : named;
        const { rows } = current.rowCount
          ? await client.query(
            `UPDATE student_profiles SET device_id = $2, student_name = $3, name_key = $4,
              class_name = $5, registration_number = $6, updated_at = now()
             WHERE id = $1 RETURNING id, device_id, student_name, class_name, registration_number`,
            [current.rows[0].id, input.deviceId, input.studentName, nameKey, input.className, input.registrationNumber]
          )
          : await client.query(
            `INSERT INTO student_profiles (id, device_id, student_name, name_key, class_name, registration_number)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, device_id, student_name, class_name, registration_number`,
            [randomUUID(), input.deviceId, input.studentName, nameKey, input.className, input.registrationNumber]
          );
        await client.query(
          `UPDATE quiz_results SET student_name = $1, class_name = $2, registration_number = $3
           WHERE student_id = $4`,
          [input.studentName, input.className, input.registrationNumber, rows[0].id]
        );
        await client.query('COMMIT');
        return mapStudent(rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        if (error.status === 409) throw error;
        if (error.code === '23505') {
          throw Object.assign(new Error('Esse nome já está cadastrado em outro dispositivo. Use o cadastro existente ou escolha outro nome.'), { status: 409 });
        }
        throw error;
      } finally {
        client.release();
      }
    },
    async insert(result) {
      const { rows } = await pool.query(
        `INSERT INTO quiz_results (id, student_id, student_name, class_name, registration_number, score, total_questions, percentage, total_time_seconds, answers, created_at, idempotency_key)
         SELECT $1, id, student_name, class_name, registration_number, $4, $5, $6, $7, $8, $9, $10
         FROM student_profiles WHERE id = $2 AND device_id = $3
         ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
         WHERE quiz_results.student_id = EXCLUDED.student_id
           AND quiz_results.score = EXCLUDED.score
           AND quiz_results.total_questions = EXCLUDED.total_questions
           AND quiz_results.percentage = EXCLUDED.percentage
           AND quiz_results.total_time_seconds = EXCLUDED.total_time_seconds
           AND quiz_results.answers = EXCLUDED.answers
         RETURNING *`,
        [result.id, result.studentId, result.deviceId, result.score, result.totalQuestions, result.percentage, result.totalTimeSeconds, JSON.stringify(result.answers), result.createdAt, result.idempotencyKey]
      );
      if (!rows.length) {
        const existing = await pool.query('SELECT 1 FROM student_profiles WHERE id = $1 AND device_id = $2', [result.studentId, result.deviceId]);
        throw Object.assign(new Error(existing.rowCount ? 'A chave de idempotência já foi usada para outro resultado.' : 'Cadastro do aluno não encontrado. Atualize o cadastro antes de enviar o resultado.'), { status: 409 });
      }
      return mapPostgresResult(rows[0]);
    },
    async rankings({ className, limit }) {
    const { rows } = await pool.query(`
        SELECT result.*, profile.id AS student_id, profile.device_id,
          profile.student_name AS current_student_name,
          profile.class_name AS current_class_name,
          profile.registration_number AS current_registration_number
        FROM student_profiles AS profile
        JOIN LATERAL (
          SELECT * FROM quiz_results AS attempt
          WHERE attempt.student_id = profile.id
          ORDER BY percentage DESC, score DESC, total_time_seconds ASC, created_at ASC
          LIMIT 1
        ) AS result ON true
        ${className ? 'WHERE lower(profile.class_name) = lower($1)' : ''}
        ORDER BY result.percentage DESC, result.score DESC, result.total_time_seconds ASC, result.created_at ASC
        LIMIT $${className ? '2' : '1'}
      `, className ? [className, limit] : [limit]);
      const latestPerStudent = new Map();
      for (const row of rows) {
        const current = latestPerStudent.get(row.student_id);
        if (!current || compararResultados(mapPostgresResult(row), mapPostgresResult(current)) < 0) {
          latestPerStudent.set(row.student_id, row);
        }
      }
      return [...latestPerStudent.values()].map(row => ({
        ...mapPostgresResult({
          ...row,
          student_name: row.current_student_name,
          class_name: row.current_class_name,
          registration_number: row.current_registration_number
        }),
        deviceId: row.device_id
      })).sort(compararResultados).slice(0, limit);
    },
    close: () => pool.end()
  };
}

function mapPostgresResult(row) {
  return {
    id: row.id,
    studentId: row.student_id,
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

function mapStudent(row) {
  return {
    id: row.id,
    deviceId: row.device_id,
    studentName: row.student_name,
    className: row.class_name,
    registrationNumber: row.registration_number
  };
}

function normalize(value) {
  return String(value).trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function createResult(input) {
  const studentName = String(input.studentName || input.name || '').trim();
  const className = String(input.className || input.turma || '').trim();
  const registrationNumber = String(input.registrationNumber || input.matricula || '').trim();
  const deviceId = String(input.deviceId || '').trim();
  const studentId = String(input.studentId || '').trim();
  const score = Number(input.score ?? input.acertos);
  const totalQuestions = Number(input.totalQuestions ?? input.total);
  const totalTimeSeconds = Number(input.totalTimeSeconds ?? input.tempoSegundos ?? 0);
  const createdAt = input.createdAt || new Date().toISOString();
  const idempotencyKey = String(input.idempotencyKey || '').trim();

  if (!studentName || studentName.length > 120 || !className || className.length > 40 || !registrationNumber || registrationNumber.length > 40 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)) {
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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw Object.assign(new Error('Chave de idempotência inválida.'), { status: 400 });
  }
  if (input.answers !== undefined && (!Array.isArray(input.answers) || input.answers.length > 200)) {
    throw Object.assign(new Error('Lista de respostas inválida.'), { status: 400 });
  }

  return {
    id: randomUUID(),
    idempotencyKey,
    studentName,
    name: studentName,
    className,
    registrationNumber,
    deviceId,
    studentId,
    score,
    totalQuestions,
    percentage: Math.round((score / totalQuestions) * 100),
    totalTimeSeconds,
    answers: input.answers || [],
    createdAt: new Date(createdAt).toISOString()
  };
}

export function createStudent(input) {
  const studentName = String(input.studentName || input.name || '').trim();
  const className = String(input.className || input.turma || '').trim();
  const registrationNumber = String(input.registrationNumber || input.matricula || '').trim();
  const deviceId = String(input.deviceId || '').trim();
  if (studentName.length < 2 || studentName.length > 120 || !className || className.length > 40 || registrationNumber.length < 3 || registrationNumber.length > 40 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
    throw Object.assign(new Error('Nome, turma, matrícula ou identificador do dispositivo inválido.'), { status: 400 });
  }
  return { studentName, nameKey: normalize(studentName), className, registrationNumber, deviceId };
}
