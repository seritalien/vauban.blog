---
name: development-directives
description: |
  Mandatory development standards enforcing test-driven development, code quality, security, and engineering excellence. 
  TRIGGERS ON: Any code modification, file creation, debugging, refactoring, implementation, bug fix, feature development, or architectural decision.
  This skill is NON-NEGOTIABLE — Claude must adhere to these directives on every code task without exception.
  Load stack-specific references (python.md, typescript.md, cairo.md, infrastructure.md) based on file types being modified.
---

# Development Directives

> **Ce document fait autorité. Le respect est obligatoire.**
> *This document is authoritative. Adherence is mandatory.*

---

## Cardinal Principles / Principes Cardinaux

### Primum Non Nocere — First, Do No Harm

- **Never introduce regressions** or break existing functionality
- **Run existing tests BEFORE making changes** to establish baseline
- When uncertain, **seek clarification** rather than assume
- Preserve backward compatibility unless explicitly instructed
- If a change feels risky, **propose it first** and await confirmation

### Epistemic Humility / Humilité Épistémique

- Acknowledge knowledge boundaries; **never fabricate information**
- Research thoroughly before implementation
- **State assumptions explicitly** before proceeding
- Cite sources for non-obvious technical decisions
- When unsure, say "I don't know" rather than guess

---

## Test-Driven Integrity / Intégrité Pilotée par les Tests

### The Inviolable Test Doctrine / Doctrine Inviolable des Tests

> **Tests are the immutable arbiter of correctness. Code must conform to tests—never the inverse.**
> *Les tests sont l'arbitre immuable de la correction. Le code doit se conformer aux tests — jamais l'inverse.*

### Mandatory Workflow / Workflow Obligatoire

```
1. IDENTIFY all pertinent tests before any modification
2. RUN existing tests — establish green baseline
3. If tests fail → FIX THEM FIRST (or clarify expected behavior)
4. WRITE/UPDATE tests for new behavior BEFORE implementation
5. IMPLEMENT the feature/fix
6. RUN all tests — confirm green
7. COMMIT only when tests pass
```

### Test Requirements / Exigences de Tests

Every test suite must include:
- ✅ **Happy paths** — normal operation
- ✅ **Edge cases** — boundaries, empty inputs, nulls
- ✅ **Error scenarios** — invalid inputs, exceptions
- ✅ **Concurrency cases** — race conditions (where applicable)

### ⚠️ WARNING: No Tests = No Code

If no tests exist for the code being modified:
1. **STOP** — do not proceed with implementation
2. **CREATE comprehensive test coverage first**
3. Then proceed with the modification

---

## Stack-Specific References / Références par Stack

Load the appropriate reference based on the task:

| File Type | Load Reference |
|-----------|----------------|
| `.py` | [references/python.md](references/python.md) |
| `.ts`, `.tsx`, `.js`, `.jsx` | [references/typescript.md](references/typescript.md) |
| `.cairo` | [references/cairo.md](references/cairo.md) |
| `.yaml`, `.yml`, `Dockerfile`, `Helm` | [references/infrastructure.md](references/infrastructure.md) |
| Git operations, commits, PRs | [references/git-workflow.md](references/git-workflow.md) |
| Architecture, design, refactoring | [references/architecture-patterns.md](references/architecture-patterns.md) |

---

## Explicit Prohibitions / Interdictions Explicites

These actions are **FORBIDDEN** without explicit user override:

| # | Prohibition | Justification |
|---|-------------|---------------|
| 1 | **Deleting or weakening tests** to make code pass | Tests define correctness |
| 2 | **Commenting out code** instead of deleting | Use version control |
| 3 | **Hardcoding secrets** or credentials | Security breach risk |
| 4 | **Empty catch blocks** or ignored errors | Silent failures are bugs |
| 5 | **Adding dependencies** without approval | Supply chain risk |
| 6 | **Breaking changes** without documentation | Downstream failures |
| 7 | **Deploying untested code** | Production incidents |
| 8 | **Copy-pasting code** without refactoring | DRY violation |
| 9 | **Debug statements** in production code | `console.log`, `print`, `dbg!` |
| 10 | **Suppressing linter warnings** without justification | Hidden issues |
| 11 | **Using `any` type** in TypeScript | Type safety bypass |
| 12 | **Float64 for currency** | Precision errors in finance |

---

## Error Handling & Resilience / Gestion des Erreurs

- **No empty catch blocks** — handle meaningfully or propagate
- **Typed exceptions** — use specific error types, not generic `Exception`
- **Graceful degradation** — fail safely with informative messages
- **Retry logic** with exponential backoff for transient failures
- **Circuit breakers** for external service calls
- **Log errors** with sufficient context for debugging

---

## Security Imperatives / Impératifs de Sécurité

### Defense in Depth

- Validate **all inputs** at system boundaries
- Sanitize **all outputs** to prevent injection
- Apply **principle of least privilege** everywhere
- Implement **audit logs** for sensitive operations

### Secrets Management

- **NEVER hardcode** credentials, API keys, or secrets
- Use environment variables or secret managers
- Ensure `.env` files are in `.gitignore`
- Rotate secrets immediately on suspected exposure

---

## Pre-Completion Checklist / Checklist Pré-Complétion

**Before declaring ANY task complete, verify:**

```
□ All existing tests pass (baseline verified)
□ New tests cover added/modified functionality
□ Linting passes with ZERO warnings
□ Type checking passes (mypy/tsc/scarb build)
□ Application builds successfully
□ Application runs and functions correctly
□ Documentation updated (docstrings, README if needed)
□ No debug artifacts remain (print, console.log, TODO)
□ Error handling is comprehensive
□ Security considerations addressed
□ Commit message follows conventional format
```

---

## Communication Protocol / Protocole de Communication

When facing ambiguity or blockers:

1. **State the ambiguity clearly** — what is uncertain?
2. **Propose options** — with trade-offs for each
3. **Recommend** — which option and why
4. **Await confirmation** — before proceeding on breaking changes

### Transparency Requirements

- Report **all failures** immediately — don't hide errors
- Explain **what was attempted** and why it failed
- Propose **next steps** or alternatives
- Never claim success if tests are failing

---

## Refactoring Discipline / Discipline de Refactoring

### Before Refactoring

1. Ensure **comprehensive test coverage** exists
2. Run tests — confirm **green baseline**
3. Make **small, incremental changes**
4. Run tests **after each change**
5. Commit frequently with descriptive messages

### Technical Debt Management

- **Document** known technical debt with `// TODO: ` or `// FIXME: `
- Include **ticket/issue reference** when available
- Prioritize debt that impacts **correctness or security**
- Never add debt silently — make it visible

---

*Adherence is mandatory. Violations require explicit user justification.*
*Le respect est obligatoire. Les violations nécessitent une justification explicite.*
