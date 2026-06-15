# 🤖 AI_USAGE.md

## 🛠️ AI Tools Used

**Primary Tool**: Claude Sonnet 4.6 (Thinking) via Antigravity IDE

---

## 🎯 Key Prompts

### 1. 🔍 Anomaly Detection Architecture
> "Design a two-tier anomaly detection pipeline for a messy CSV. Tier 1 should catch format errors via Zod, Tier 2 should apply business logic with cross-row context (duplicates, timeline violations). The pipeline must return a structured JSON report without touching the database."

### 2. 📉 Greedy Debt Simplification
> "Implement a greedy minimum-transactions debt simplification algorithm. Input: raw debt edges {from, to, amount}. Output: minimum settlement list. Include handling for settlements (already-paid debts) that reduce the raw graph."

### 3. ✨ Gemini Integration for Anomaly Context
> "Integrate Gemini 2.0 Flash to generate plain-English explanations for complex CSV import anomalies. Only call the API for specific anomaly types. Return a fallback if the API fails — the import must never crash due to AI unavailability."

---

## 🐛 Three Cases Where AI Got It Wrong

### Case 1: 🧮 Percentage Rounding in Split Calculator
**What AI produced**: The original `calculatePercentageSplit` computed each share as `(total * pct) / 100` and summed them. Due to floating-point arithmetic, `₹1440 × 30% = ₹432.0` × 3 + `₹1440 × 20% = ₹288.0` = `₹1584.0` ≠ `₹1440`.

**How I caught it**: Hand-calculated row 15 (Pizza Friday) and got a sum that didn't match the total. The AI had forgotten to apply a rounding correction step.

**What I changed**: Added a post-calculation correction loop: `const diff = totalInr - computedTotal; if (diff !== 0) results[0].shareAmount += diff;` — assigning any remaining paisa to the first member deterministically.

---

### Case 2: 🛑 Transaction Scope in csv-commit.service.js
**What AI produced**: The original commit service called `prisma.user.upsert()` (for auto-creating guest users like Kabir) INSIDE the `prisma.$transaction()` block.

**How I caught it**: Prisma's interactive transactions don't support nested writes to the same models that are in flight. The upsert call would have deadlocked or thrown `P2028` (transaction timeout) in high-concurrency scenarios.

**What I changed**: Moved the guest user upsert to the **pre-processing phase** (before the transaction starts). The transaction only contains expense/split/settlement creates and the ImportBatch status update.

---

### Case 3: 💥 Fingerprint Collision in Duplicate Detection
**What AI produced**: The initial `buildFingerprint()` function used `description.toLowerCase()` directly. This meant "Dinner at Marina Bites" and "dinner - marina bites" would NOT produce the same fingerprint (different non-alpha chars).

**How I caught it**: Manually traced through A1 anomaly detection with the actual CSV values. The fingerprints were different, so the duplicate would have been silently imported.

**What I changed**: Added `.replace(/[^a-z0-9]/g, '')` after lowercasing — strips all punctuation and spaces so "dinneratmarinabites" === "dinnermarinabites" regardless of formatting. This is more aggressive but correct for this use case.
