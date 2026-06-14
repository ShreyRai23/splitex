// src/api/index.js — exports all API modules
export { default as client } from './client.js';

import client from './client.js';

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  register: (data) => client.post('/auth/register', data),
  login:    (data) => client.post('/auth/login', data),
};

// ── Users ─────────────────────────────────────────────────────
export const usersApi = {
  list:  ()   => client.get('/users'),
  get:   (id) => client.get(`/users/${id}`),
};

// ── Groups ────────────────────────────────────────────────────
export const groupsApi = {
  list:         ()          => client.get('/groups'),
  get:          (id)        => client.get(`/groups/${id}`),
  create:       (data)      => client.post('/groups', data),
  addMember:    (id, data)  => client.post(`/groups/${id}/members`, data),
  removeMember: (id, uid, data) => client.patch(`/groups/${id}/members/${uid}`, data),
};

// ── Expenses ──────────────────────────────────────────────────
export const expensesApi = {
  list:   (params)      => client.get('/expenses', { params }),
  get:    (id)          => client.get(`/expenses/${id}`),
  create: (data, idKey) => client.post('/expenses', data, {
    headers: idKey ? { 'X-Idempotency-Key': idKey } : {},
  }),
  update: (id, data)    => client.patch(`/expenses/${id}`, data),
  delete: (id)          => client.delete(`/expenses/${id}`),
};

// ── Settlements ───────────────────────────────────────────────
export const settlementsApi = {
  list:   (params) => client.get('/settlements', { params }),
  get:    (id)     => client.get(`/settlements/${id}`),
  create: (data)   => client.post('/settlements', data),
};

// ── Balances ──────────────────────────────────────────────────
export const balancesApi = {
  group: (groupId)          => client.get(`/balances/group/${groupId}`),
  user:  (userId, groupId)  => client.get(`/balances/user/${userId}`, { params: { groupId } }),
};

// ── Import ────────────────────────────────────────────────────
export const importApi = {
  dryRun: (formData) => client.post('/import/dry-run', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }),
  commit:      (data)    => client.post('/import/commit', data),
  listBatches: ()        => client.get('/import/batches'),
  getBatch:    (batchId) => client.get(`/import/batches/${batchId}`),
};

// ── Audit Logs ────────────────────────────────────────────────
export const auditApi = {
  list: (params) => client.get('/audit-logs', { params }),
};
