'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const VALID_STATUS = new Set(['pending', 'done']);

function taskOut(row) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    subject: row.subject,
    dueAt: row.due_at,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

router.get('/', (req, res) => {
  const { from, to, status } = req.query;
  const clauses = ['user_id = ?'];
  const params = [req.user.id];

  if (from) {
    clauses.push('(due_at IS NOT NULL AND due_at >= ?)');
    params.push(String(from));
  }
  if (to) {
    clauses.push('(due_at IS NOT NULL AND due_at <= ?)');
    params.push(String(to));
  }
  if (status && VALID_STATUS.has(status)) {
    clauses.push('status = ?');
    params.push(status);
  }

  const rows = db
    .prepare(
      `SELECT * FROM tasks WHERE ${clauses.join(' AND ')} ORDER BY (due_at IS NULL), due_at ASC, id ASC`
    )
    .all(...params);

  res.json({ tasks: rows.map(taskOut) });
});

router.post('/', (req, res) => {
  const { title, notes, subject, dueAt, priority } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO tasks (user_id, title, notes, subject, due_at, status, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    )
    .run(req.user.id, title.trim(), notes || null, subject || null, dueAt || null, priority || null, now, now);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ task: taskOut(task) });
});

function loadOwnedTask(userId, taskId) {
  return db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(Number(taskId), userId);
}

router.patch('/:id', (req, res) => {
  const task = loadOwnedTask(req.user.id, req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { title, notes, subject, dueAt, status, priority } = req.body || {};
  if (status !== undefined && !VALID_STATUS.has(status)) {
    return res.status(400).json({ error: `Invalid status: ${status}` });
  }

  const now = new Date().toISOString();
  const nextStatus = status !== undefined ? status : task.status;
  const completedAt = nextStatus === 'done' ? (task.completed_at || now) : null;

  db.prepare(
    `UPDATE tasks SET
       title = COALESCE(?, title),
       notes = CASE WHEN ? THEN ? ELSE notes END,
       subject = CASE WHEN ? THEN ? ELSE subject END,
       due_at = CASE WHEN ? THEN ? ELSE due_at END,
       status = ?,
       priority = CASE WHEN ? THEN ? ELSE priority END,
       completed_at = ?,
       updated_at = ?
     WHERE id = ?`
  ).run(
    title && title.trim() ? title.trim() : null,
    notes !== undefined ? 1 : 0,
    notes ?? null,
    subject !== undefined ? 1 : 0,
    subject ?? null,
    dueAt !== undefined ? 1 : 0,
    dueAt ?? null,
    nextStatus,
    priority !== undefined ? 1 : 0,
    priority ?? null,
    completedAt,
    now,
    task.id
  );

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json({ task: taskOut(updated) });
});

router.delete('/:id', (req, res) => {
  const task = loadOwnedTask(req.user.id, req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  res.status(204).end();
});

module.exports = router;
