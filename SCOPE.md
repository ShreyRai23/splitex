# 📋 SCOPE.md — Anomaly Log & Database Schema

## 🗄️ Database Schema

```
users
  id            INT PK
  name          VARCHAR UNIQUE
  email         VARCHAR UNIQUE
  passwordHash  VARCHAR
  isGuest       BOOLEAN (true for auto-created guest users like Kabir)
  createdAt, updatedAt

groups
  id            INT PK
  name          VARCHAR UNIQUE
  createdAt, updatedAt

group_memberships
  id            INT PK
  userId        FK → users.id
  groupId       FK → groups.id
  joinedAt      DATE
  leftAt        DATE (null = still active)

expenses
  id                INT PK
  groupId           FK → groups.id
  paidById          FK → users.id
  description       VARCHAR
  originalAmount    DECIMAL(12,4)   ← raw CSV value, never changed
  originalCurrency  VARCHAR
  amountInr         DECIMAL(12,2)   ← normalized, used for all math
  exchangeRate      DECIMAL(10,6)   ← null for INR, 84.0 for USD
  date              DATE
  splitType         ENUM(equal, percentage, exact, share)
  notes             TEXT
  idempotencyKey    VARCHAR UNIQUE
  importBatchId     VARCHAR
  createdAt, updatedAt

expense_splits
  id            INT PK
  expenseId     FK → expenses.id
  userId        FK → users.id
  shareAmount   DECIMAL(12,2)  ← exact INR this user owes
  shareRatio    DECIMAL(10,4)  ← original input (% / share count / ratio)

settlements
  id            INT PK
  payerId       FK → users.id
  payeeId       FK → users.id
  amount        DECIMAL(12,2)
  currency      VARCHAR
  amountInr     DECIMAL(12,2)
  date          DATE
  note          TEXT
  importBatchId VARCHAR
  createdAt

import_batches
  id            UUID PK
  status        ENUM(DRY_RUN_PENDING, DRY_RUN_COMPLETE, COMMITTED, ROLLED_BACK)
  reportJson    JSON
  committedById INT
  createdAt, committedAt

audit_logs
  id            INT PK
  userId        FK → users.id (null for system)
  action        VARCHAR
  targetType    VARCHAR
  targetId      VARCHAR
  detail        JSON
  createdAt
```

---

## 🚨 Anomaly Log

### A1 — Exact Duplicate (Row 6)
**Problem**: "dinner - marina bites" (row 6) is a case/formatting variant of "Dinner at Marina Bites" (row 5). Same date (08-02-2026), same payer (Dev), same amount (₹3200).
**Detection**: Fingerprint = normalize(description) + date + payer + amount. Row 5 and 6 match.
**Policy**: SKIP row 6. Row 5 is the canonical record.

### A2 — Comma-Formatted Amount (Row 7)
**Problem**: Amount is `"1,200"` (string with comma) — not parseable as a number by default.
**Detection**: Tier 1 Zod transform — strips commas before parsing.
**Policy**: AUTO-FIX. Strip comma, parse as `1200`. Log FORMAT_COMMA_AMOUNT warning.

### A3 — Sub-Paisa Precision (Row 10)
**Problem**: Amount `899.995` has 3 decimal places. INR has 2 decimal places (paisa).
**Detection**: After comma-stripping, check if `Math.round(v*100)/100 !== v`.
**Policy**: AUTO-FIX. Round to `900.00`. Log ROUNDING_SUBPAISA info.

### A4 — Unknown Payer (Row 11)
**Problem**: `paid_by = "Priya S"` — doesn't match any known user. Closest match: "Priya".
**Detection**: Name not in `KNOWN_USERS` set. Prefix match finds "Priya".
**Policy**: AUTO-FIX with user confirmation. Map "Priya S" → "Priya". Flag UNKNOWN_PAYER.

### A5 — Missing Payer (Row 13)
**Problem**: `paid_by` is empty for "House cleaning supplies". Note: "can't remember who paid".
**Detection**: Empty string after trim.
**Policy**: BLOCKED — cannot import without a payer. User must SKIP or specify payer.

### A6 — Disguised Settlement (Row 14)
**Problem**: "Rohan paid Aisha back" — note says "this is a settlement not an expense??". Has no split_type.
**Detection**: Empty split_type + description/notes contain "paid back", "settlement".
**Policy**: CONVERT_TO_SETTLEMENT. Creates a Settlement record (Rohan→Aisha, ₹5000) instead of an expense.

### A7 — Percentage Mismatch (Row 15)
**Problem**: "Pizza Friday" split percentages: 30+30+30+20 = 110%. Note says "percentages might be off".
**Detection**: Sum of percentage values ≠ 100 (±0.01 tolerance).
**Policy**: BLOCKED — user must correct percentages. Suggested fix: 25%/25%/25%/25% (equal) or correct values.

### A8 — Non-Member in Split (Row 23)
**Problem**: "Parasailing" split includes "Dev's friend Kabir" — not a registered user.
**Detection**: Split member name not in known users list.
**Policy**: AUTO-CREATE guest user "Kabir" (per user's decision). Flag NON_MEMBER_IN_SPLIT warning.

### A9 — Conflicting Duplicate (Rows 24 + 25)
**Problem**: "Dinner at Thalassa" (Aisha, ₹2400) and "Thalassa dinner" (Rohan, ₹2450) on same date. Row 25 note: "Aisha also logged this I think hers is wrong".
**Detection**: Similar description + same date. Note mentions "also logged" or "hers is wrong".
**Policy**: SKIP row 24 (Aisha's). KEEP row 25 (Rohan's ₹2450) — per user's pre-decision.

### A10 — Bad Date Format (Row 27)
**Problem**: Date is `"Mar-14"` — not DD-MM-YYYY. No year.
**Detection**: Doesn't match `/^\d{2}-\d{2}-\d{4}$/`. Matches `/^([A-Za-z]{3})-(\d{1,2})$/`.
**Policy**: AUTO-PARSE as March 14, 2026 (year inferred from CSV context). Flag AMBIGUOUS_DATE for user confirmation.

### A11 — Missing Currency (Row 28)
**Problem**: "Groceries DMart" on 15-03-2026 has empty currency field.
**Detection**: Empty string after trim.
**Policy**: DEFAULT to INR based on surrounding context (all other March grocery rows are INR). Flag MISSING_CURRENCY for user confirmation.

### A12 — Zero Amount (Row 31)
**Problem**: "Dinner order Swiggy" has amount = 0. Note: "counted twice earlier - fixing later".
**Detection**: Parsed amount === 0.
**Policy**: SKIP — a zero-amount expense has no financial effect and the note implies it's a void marker.

### A13 — Ambiguous Date (Row 34)
**Problem**: Date `04-05-2026`. Note says "is this April 5 or May 4? format is a mess".
**Detection**: Note contains "april 5 or may 4".
**Policy**: Use DD-MM-YYYY convention → April 5, 2026. Flag AMBIGUOUS_DATE for user confirmation.

### A14 — Timeline Violation (Row 36)
**Problem**: "Groceries BigBasket" on 02-04-2026 includes Meera (left 31-03-2026) in split_with.
**Detection**: Check each split member's `leftAt` date against the expense date.
**Policy**: AUTO-FIX. Remove Meera from split. Remaining 3 members (Aisha, Rohan, Priya) absorb cost equally. Flag TIMELINE_VIOLATION warning.

### A15 — Deposit as Expense (Row 38)
**Problem**: "Sam deposit share" — Sam pays Aisha ₹15000 "moving in deposit". This is a peer transfer, not a shared expense.
**Detection**: Description contains "deposit". Notes: "Sam moving in! paid Aisha his deposit".
**Policy**: CONVERT_TO_SETTLEMENT. Creates a Settlement record (Sam→Aisha, ₹15000).

### A16 — Split Type Conflict (Row 42)
**Problem**: `split_type = "equal"` but `split_details = "Aisha 1; Rohan 1; Priya 1; Sam 1"` is present. Note: "split_type says equal but someone added shares anyway".
**Detection**: split_type is "equal" but split_details is non-empty.
**Policy**: Since all share values are equal (1:1:1:1), result is the same. AUTO-FIX: discard split_details and apply equal split. Flag SPLIT_TYPE_CONFLICT as INFO.
