# 💸 SpilTeX — Intelligent Shared Expenses

SpilTeX is a full-stack shared expense tracker built to solve real-world flatmate disputes. It features an AI-powered CSV import engine, strict temporal group memberships (respecting when people move in/out), a greedy debt simplification algorithm to minimize transactions, and a robust audit log.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18+
- **Database**: PostgreSQL (or MySQL)
- **AI Key**: Gemini API key from [Google AI Studio](https://aistudio.google.com)

### 1. Backend Setup ⚙️
```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, and GEMINI_API_KEY

# Push database schema & seed initial demo data
npm run db:push
npm run db:seed

# Start the development server
npm run dev
# Server runs on http://localhost:3000
```

### 2. Frontend Setup 🎨
Open a new terminal tab:
```bash
cd frontend
npm install

# Start the Vite development server
npm run dev
# App runs on http://localhost:5173
```

---

## ✨ Key Features

- **🤖 AI CSV Import Engine**: 2-phase import flow that parses messy CSVs, detects 16 different types of anomalies (duplicate entries, missing users, timeline violations), and uses Gemini to suggest resolutions.
- **🧮 Smart Split Engine**: Supports Equal, Exact Amount, Percentage, and Custom Share splits.
- **📉 Debt Simplification**: A greedy `O(n log n)` algorithm computes the absolute minimum number of peer-to-peer transactions needed to settle all group debts.
- **📅 Member Timelines**: Accurately tracks `joinedAt` and `leftAt`. Expenses are only split among members active on the exact date of the expense.
- **🔒 Full Auditability**: Every write operation (Create, Update, Delete) logs an immutable `AuditLog` so you know exactly who modified a split and when.

---

## 🤖 AI Integration & Usage
We use **Google Gemini 2.0 Flash** strictly for the **Phase 1 CSV Dry-Run**. 
It is invoked to provide human-readable, plain-English context for complex anomalies (e.g., Conflicting Duplicates, Split Type Conflicts) so the user can make an informed decision before committing the import to the database.

> **Note**: For a detailed breakdown of prompts and AI failure cases, please read [AI_USAGE.md](./AI_USAGE.md).

---

## 📂 Project Documentation

This repository contains all required documentation for the assessment:

- 📄 **[SCOPE.md](./SCOPE.md)**: Database schema and the complete Anomaly Log (detailing the 16 data problems found in the CSV and how the system handles them).
- 📄 **[DECISIONS.md](./DECISIONS.md)**: Engineering decision log detailing architecture choices, options considered, and why we chose what we chose.
- 📄 **[AI_USAGE.md](./AI_USAGE.md)**: Specifics on AI tools used, key prompts, and cases where the AI produced incorrect code and how it was caught/fixed.

---

## 🔐 Architecture Notes
- **Idempotency**: Expense creation routes require an `X-Idempotency-Key` header to prevent duplicate charges on double-clicks.
- **Data Isolation**: A strict `authz` middleware ensures users can only access expenses, balances, and audit logs for groups they actively belong to.
- **Live Computations**: To prevent stale data, user balances are always computed live from `expense_splits` and `settlements` rather than caching a balance column.
