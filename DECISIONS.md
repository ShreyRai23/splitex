# ⚖️ DECISIONS.md — Engineering Decision Log

## 🏗️ D1: Two-Phase Import Architecture

**Decision**: Implement strict Phase 1 (dry-run, no DB writes) → Phase 2 (atomic commit) separation.

**Options considered**:
- Option A: Parse and write in one step, rollback on error
- Option B: Two-phase with persisted report (chosen)
- Option C: Queue-based async processing

**Why B**: The spec explicitly requires surfacing anomalies to the user and getting approval before writing. Option A can't surface anomalies before writing. Option C is over-engineered for this scale. Phase 1 stores the report in `ImportBatch` so the user can review at their own pace and call commit later — even from a different session.

---

## 💱 D2: Static Exchange Rate

**Decision**: USD→INR rate locked at ₹84.00, read from `.env` at startup.

**Options considered**:
- Option A: Live rate from ExchangeRate-API at import time
- Option B: Prompted rate input from user at import time
- Option C: Static rate in config (chosen)

**Why C**: The spec says "static exchange rate at the exact moment of ingestion." A static config rate is reproducible — recalculating balances later will always produce the same number. Live rates break this. Prompted input is good UX but outside MVP scope.

---

## 📉 D3: Greedy Debt Simplification

**Decision**: Net-balance greedy algorithm (sort creditors and debtors, match biggest-to-biggest).

**Options considered**:
- Option A: Show all pairwise debts (O(n²) transactions)
- Option B: Greedy net-balance (chosen)
- Option C: Integer programming for provably optimal solution

**Why B**: Greedy produces optimal results (minimum transactions = n-1 maximum) for the net-balance formulation. It's O(n log n), easy to test, and easy to explain line-by-line. Option C is overkill for n≤10 users.

---

## 🕵️ D4: Rohan's Auditability — No Cached Balance Column

**Decision**: Balances are always computed live from `expense_splits` + `settlements`. No `balance` column on any table.

**Options considered**:
- Option A: Cached `balance` column updated on every write (trigger or application logic)
- Option B: Live computation (chosen)

**Why B**: Cached balances can go stale and are hard to audit. With live computation, the balance for any user is always exactly the sum of their split rows minus their settlements — verifiable by anyone with DB access. Performance is fine at this scale (a few hundred rows).

---

## 📊 D5: ExpenseSplit.shareRatio Column

**Decision**: Store the raw input value (%, share count, or 1/n) in `shareRatio` alongside the computed `shareAmount`.

**Why**: This is pure auditability. If Rohan asks "why is my share ₹525 and not ₹600?", we can show him `shareRatio = 30` (30%) applied to ₹1750 total = ₹525. Without `shareRatio`, the split calculation is a black box.

---

## 👤 D6: Kabir as Guest User

**Decision**: Auto-create "Kabir" as a `isGuest=true` user when his name appears in a CSV split.

**Options considered**:
- Option A: Block the row — require Kabir to register first
- Option B: Absorb Kabir's share into Dev's (since Dev brought him)
- Option C: Auto-create guest (chosen)

**Why C**: User confirmed this decision. Guest users participate in splits but cannot log in. Their debts are tracked but they can never owe money back to the group (Dev should settle with Kabir externally). This mirrors how real expense apps handle one-time guests.

---

## ⚔️ D7: Thalassa Conflict Resolution

**Decision**: Keep Rohan's row (₹2450, row 25). Skip Aisha's row (₹2400, row 24).

**Why**: Row 25 note explicitly says "Aisha also logged this I think hers is wrong." The user confirmed this decision. We SKIP rather than delete — the original row is preserved in the dry-run report for the audit trail (Meera's constraint: "I want to approve anything the app changes").

---

## 🛡️ D8: Idempotency via DB Column vs. In-Memory Cache

**Decision**: Store idempotency key in `expense.idempotencyKey` (DB column) rather than Redis/in-memory cache.

**Options considered**:
- Option A: Redis with TTL (requires separate infra)
- Option B: In-memory Map (lost on restart)
- Option C: DB unique column (chosen)

**Why C**: Durable across server restarts, zero extra infrastructure, works correctly in single-instance deployments. For distributed deployments, the DB unique constraint still prevents duplicates. Downside: slightly slower than Redis — acceptable at this scale.

---

## 🧠 D9: Gemini Called Only for Complex Anomalies

**Decision**: Only invoke Gemini for 6 anomaly types: PERCENTAGE_MISMATCH, CONFLICTING_DUPLICATE, ZERO_AMOUNT, AMBIGUOUS_DATE, UNKNOWN_PAYER, SPLIT_TYPE_CONFLICT, NON_MEMBER_IN_SPLIT, SETTLEMENT_DISGUISED.

**Why**: Format fixes (comma removal, rounding) are deterministic — explaining them with AI adds latency and burns quota for zero user value. Complex anomalies genuinely benefit from a natural-language explanation of the business logic impact.

---

## 🧩 D10: SplitType "unequal" → "exact" Mapping

**Decision**: CSV uses `split_type = "unequal"` (row 12 birthday cake). DB enum uses `exact`. We map during ingestion.

**Why**: "exact" is more semantically precise (each person owes an exact amount). "unequal" is ambiguous — it could mean percentage or share-based. The mapping is documented in the CSV parser so it's traceable.
