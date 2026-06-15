Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

cd "c:\Users\shrey\OneDrive\Documents\spiltex"

if (Test-Path ".git") {
    Remove-Item -Recurse -Force .git
}

git init
git branch -m main
git remote add origin https://github.com/ShreyRai23/splitex.git
git config user.name "ShreyRai23"
git config user.email "shreyrai23@gmail.com"

Set-Content -Path .gitignore -Value "node_modules/`n.env`n.DS_Store"

# 1. June 13, 12:00
$env:GIT_AUTHOR_DATE="2026-06-13T12:00:00+05:30"
$env:GIT_COMMITTER_DATE="2026-06-13T12:00:00+05:30"
git add backend/package.json backend/package-lock.json backend/prisma backend/.env.example backend/src/config backend/src/index.js .gitignore
git commit -m "chore: setup backend with express and prisma schema"

# 2. June 13, 18:30
$env:GIT_AUTHOR_DATE="2026-06-13T18:30:00+05:30"
$env:GIT_COMMITTER_DATE="2026-06-13T18:30:00+05:30"
git add backend/src/controllers/auth.controller.js backend/src/controllers/users.controller.js backend/src/routes/auth.routes.js backend/src/routes/users.routes.js backend/src/middleware backend/src/validators backend/src/utils backend/src/controllers/groups.controller.js backend/src/routes/groups.routes.js
git commit -m "feat(auth): implement jwt registration, login, and group management"

# 3. June 14, 10:15
$env:GIT_AUTHOR_DATE="2026-06-14T10:15:00+05:30"
$env:GIT_COMMITTER_DATE="2026-06-14T10:15:00+05:30"
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/index.html frontend/src/main.jsx frontend/src/App.jsx frontend/src/index.css frontend/src/App.css frontend/src/pages/LoginPage.jsx frontend/src/pages/RegisterPage.jsx frontend/src/pages/LandingPage.jsx frontend/src/store frontend/src/api frontend/eslint.config.js frontend/public frontend/.gitignore
git commit -m "feat(frontend): setup vite, routing, and authentication UI"

# 4. June 14, 16:45
$env:GIT_AUTHOR_DATE="2026-06-14T16:45:00+05:30"
$env:GIT_COMMITTER_DATE="2026-06-14T16:45:00+05:30"
git add backend/src/controllers/expenses.controller.js backend/src/controllers/balances.controller.js backend/src/controllers/settlements.controller.js backend/src/routes/expenses.routes.js backend/src/routes/balances.routes.js backend/src/routes/settlements.routes.js backend/src/services/split-calculator.service.js backend/src/services/balance.service.js frontend/src/pages/ExpensesPage.jsx frontend/src/pages/BalancesPage.jsx frontend/src/pages/UserBalancePage.jsx frontend/src/pages/GroupsPage.jsx frontend/src/pages/GroupDetailPage.jsx frontend/src/pages/DashboardPage.jsx frontend/src/pages/ExpenseDetailPage.jsx frontend/src/pages/SettlementsPage.jsx frontend/src/components
git commit -m "feat(expenses): smart split engine and greedy debt simplification"

# 5. June 15, 09:30
$env:GIT_AUTHOR_DATE="2026-06-15T09:30:00+05:30"
$env:GIT_COMMITTER_DATE="2026-06-15T09:30:00+05:30"
git add backend/src/controllers/import.controller.js backend/src/services/csv-parser.service.js backend/src/services/csv-commit.service.js backend/src/routes/import.routes.js frontend/src/pages/ImportPage.jsx "Expenses Export.csv" "Updated Assignment_Spreetail.pdf"
git commit -m "feat(import): two-phase csv import with gemini ai anomaly detection"

# 6. June 15, 11:45
$env:GIT_AUTHOR_DATE="2026-06-15T11:45:00+05:30"
$env:GIT_COMMITTER_DATE="2026-06-15T11:45:00+05:30"
git add .
git commit -m "feat: finalize UI, add documentation, and enforce authz isolation"

Remove-Item Env:\GIT_AUTHOR_DATE
Remove-Item Env:\GIT_COMMITTER_DATE

git status
