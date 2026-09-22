-- Tabelas do Performance Quest

-- Tabela de alunos
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    class_name VARCHAR(20) NOT NULL,
    registration VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--Tabela de tentativas de quiz
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    total_time_seconds INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


--Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_attempts_student ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_percentage ON quiz_attempts(percentage DESC);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);