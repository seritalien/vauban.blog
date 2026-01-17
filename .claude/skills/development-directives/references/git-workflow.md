# Git Workflow Standards

> Reference for version control, commits, branches, and pull requests

---

## Branch Strategy

### Protected Branches

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production-ready code | Required reviews, CI pass |
| `develop` | Integration branch | Required CI pass |

### Feature Branches

```
feature/<ticket-id>-<short-description>
fix/<ticket-id>-<short-description>
refactor/<short-description>
docs/<short-description>
chore/<short-description>
```

**Examples:**
```
feature/PROJ-123-user-authentication
fix/PROJ-456-login-redirect
refactor/extract-payment-service
docs/api-documentation
chore/update-dependencies
```

---

## Conventional Commits

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add OAuth2 login` |
| `fix` | Bug fix | `fix(api): handle null response` |
| `docs` | Documentation | `docs(readme): add setup guide` |
| `style` | Formatting (no code change) | `style: fix indentation` |
| `refactor` | Code restructure (no behavior change) | `refactor(db): extract query builder` |
| `perf` | Performance improvement | `perf(query): add index for user lookup` |
| `test` | Add/fix tests | `test(auth): add login edge cases` |
| `build` | Build system changes | `build: upgrade webpack to v5` |
| `ci` | CI configuration | `ci: add staging deploy workflow` |
| `chore` | Maintenance | `chore: update dependencies` |
| `revert` | Revert previous commit | `revert: feat(auth): add OAuth2 login` |

### Breaking Changes

```
feat(api)!: change user endpoint response format

BREAKING CHANGE: User endpoint now returns { data: User } instead of User directly.
Clients must update to access user.data.
```

### Scope Examples

- `auth`, `api`, `db`, `ui`, `core`
- `contracts`, `frontend`, `backend`
- Component names: `Button`, `LoginForm`, `PaymentService`

---

## Commit Guidelines

### Good Commits

```bash
# ✅ Atomic — One logical change
git commit -m "feat(auth): implement JWT token refresh"

# ✅ Descriptive — Clear what changed
git commit -m "fix(api): handle race condition in concurrent requests"

# ✅ Imperative mood — "Add" not "Added"
git commit -m "refactor(db): extract connection pooling logic"
```

### Bad Commits

```bash
# ❌ Vague
git commit -m "fix stuff"

# ❌ Multiple changes
git commit -m "fix login bug and add user profile and update deps"

# ❌ Past tense
git commit -m "fixed the login bug"

# ❌ WIP commits pushed to shared branch
git commit -m "WIP"
```

---

## Commit Message Template

```
# Type: feat, fix, docs, style, refactor, perf, test, build, ci, chore
# Scope: module/component affected
# Subject: imperative, max 50 chars, no period

# Body: explain WHAT and WHY (not HOW), wrap at 72 chars

# Footer: reference issues, note breaking changes

# Examples:
# feat(auth): add password reset flow
# fix(api): prevent null pointer in user lookup
# docs(readme): add deployment instructions
# BREAKING CHANGE: API now requires authentication
# Closes #123
```

Save as `.gitmessage` and configure:
```bash
git config --global commit.template ~/.gitmessage
```

---

## Pull Request Template

```markdown
## Description

Brief description of the changes.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would break existing functionality)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)

## Related Issues

Closes #<issue-number>

## Checklist

- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have added tests that prove my fix/feature works
- [ ] All new and existing tests pass locally
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings
- [ ] I have checked for security implications

## Testing

Describe how you tested these changes:
1. Step one
2. Step two

## Screenshots (if applicable)

## Additional Notes

Any additional context or notes for reviewers.
```

---

## Pre-Push Checklist

```bash
# Before pushing, verify:
□ git status              # No unintended changes
□ git diff --staged       # Review what's being committed
□ npm test                # All tests pass
□ npm run lint            # No linting errors
□ npm run type-check      # No type errors
□ git log --oneline -5    # Commits are atomic and well-described
```

---

## Git Commands Reference

### Daily Workflow

```bash
# Start new feature
git checkout develop
git pull origin develop
git checkout -b feature/PROJ-123-new-feature

# Stage and commit
git add -p                      # Interactive staging
git commit                      # Opens editor with template
git push -u origin feature/PROJ-123-new-feature

# Keep branch updated
git fetch origin
git rebase origin/develop       # Prefer rebase over merge

# Squash before merge (if needed)
git rebase -i HEAD~3            # Squash last 3 commits
```

### Fixing Mistakes

```bash
# Amend last commit (not yet pushed)
git commit --amend

# Undo last commit, keep changes
git reset --soft HEAD~1

# Undo last commit, discard changes
git reset --hard HEAD~1

# Revert a pushed commit
git revert <commit-hash>

# Cherry-pick specific commit
git cherry-pick <commit-hash>
```

### Cleaning Up

```bash
# Delete merged branches locally
git branch --merged | grep -v "main\|develop" | xargs git branch -d

# Delete remote tracking branches for deleted remotes
git fetch --prune

# Clean untracked files (dry-run first)
git clean -n
git clean -fd
```

---

## Git Hooks (via Husky)

### package.json

```json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### Pre-commit Hook

```bash
#!/bin/sh
# .husky/pre-commit

npx lint-staged
npm run type-check
```

### Commit-msg Hook

```bash
#!/bin/sh
# .husky/commit-msg

npx --no -- commitlint --edit $1
```

### commitlint.config.js

```javascript
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],
    ],
    "subject-case": [2, "always", "lower-case"],
    "subject-max-length": [2, "always", 72],
  },
};
```

---

## Code Review Guidelines

### As Reviewer

1. **Understand the context** — Read the PR description and linked issues
2. **Check the tests** — Are edge cases covered?
3. **Review for clarity** — Is the code self-documenting?
4. **Verify standards** — Does it follow project conventions?
5. **Be constructive** — Suggest improvements, don't just criticize

### As Author

1. **Keep PRs small** — Easier to review, faster to merge
2. **Self-review first** — Catch obvious issues
3. **Provide context** — Explain the why, not just the what
4. **Respond promptly** — Keep the review cycle tight
5. **Don't take it personally** — Feedback improves the code

---

*Apply these standards to all Git operations without exception.*
