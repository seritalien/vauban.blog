# Roles & Permissions

Vauban Blog implements a 7-tier role-based access control (RBAC) system. Each role inherits all permissions from lower roles.

---

## Role Hierarchy

```
Level 6 │ OWNER        │ Platform governance, emergency controls
        │              │
Level 5 │ ADMIN        │ Full platform management
        │              │
Level 4 │ EDITOR       │ Content approval, featuring
        │              │
Level 3 │ MODERATOR    │ Community moderation
        │              │
Level 2 │ CONTRIBUTOR  │ Direct publishing (trusted)
        │              │
Level 1 │ WRITER       │ Submit content for review
        │              │
Level 0 │ READER       │ View, like, comment
```

---

## Detailed Role Descriptions

### READER (Level 0)

> **Default role for all connected wallets**

**Persona**: Casual visitors, content consumers, community members

**Capabilities**:
- View all public content
- Like articles
- Comment on articles
- Follow authors
- Bookmark articles
- Receive newsletters

**Restrictions**:
- Cannot create posts
- Cannot submit content
- Cannot access any admin features

**How to get this role**: Connect any wallet (ArgentX, Braavos)

---

### WRITER (Level 1)

> **Content creators who submit work for editorial review**

**Persona**: New authors, guest contributors, aspiring journalists

**Capabilities**:
- Everything a Reader can do, plus:
- Create draft posts
- Submit posts for editorial review
- Edit own drafts (before submission)
- View own submission status
- Access personal dashboard

**Restrictions**:
- Cannot publish directly (requires Editor approval)
- Cannot edit published posts
- Cannot access other users' content

**How to get this role**:
- Request upgrade from Admin
- Automatic after completing profile verification

**Typical workflow**:
```
1. Write article in Markdown editor
2. Add tags, cover image, metadata
3. Click "Submit for Review"
4. Wait for Editor approval/feedback
5. Make revisions if requested
6. Article published after approval
```

---

### CONTRIBUTOR (Level 2)

> **Trusted authors who can publish without review**

**Persona**: Established writers, regular columnists, verified experts

**Capabilities**:
- Everything a Writer can do, plus:
- **Publish immediately** (bypass review queue)
- Edit own published posts
- Delete own posts
- Access advanced analytics for own content

**Restrictions**:
- Cannot moderate other users
- Cannot approve other posts
- Cannot access platform-wide analytics

**How to get this role**:
- Automatic promotion after 5 approved posts
- Manual promotion by Admin
- Staking requirement (optional configuration)

**Trust indicators**:
- 🔒 "Trusted" badge on profile
- Posts marked as "Direct publish"
- Higher visibility in search results

---

### MODERATOR (Level 3)

> **Community guardians who handle reports and violations**

**Persona**: Community managers, volunteer moderators, trust & safety team

**Capabilities**:
- Everything a Contributor can do, plus:
- View reported content queue
- Resolve reports (approve/dismiss)
- Hide/unhide comments
- Temporarily ban users (up to 7 days)
- Issue warnings to users
- View user moderation history

**Restrictions**:
- Cannot permanently ban users
- Cannot delete posts (only hide)
- Cannot approve pending posts
- Cannot access financial data

**How to get this role**: Manual assignment by Admin

**Moderation workflow**:
```
1. Review incoming reports
2. Examine reported content
3. Check reporter/reportee history
4. Take action:
   - Dismiss (false report)
   - Warning (minor violation)
   - Hide content (policy violation)
   - Temp ban (repeat offender)
5. Document decision
```

**Moderation actions**:

| Action | Effect | Reversible |
|--------|--------|------------|
| Dismiss report | Close without action | N/A |
| Issue warning | Notification to user | Yes |
| Hide comment | Comment hidden (not deleted) | Yes |
| Hide post | Post hidden from public | Yes |
| Temp ban (1-7 days) | User cannot post/comment | Auto-expires |

---

### EDITOR (Level 4)

> **Editorial gatekeepers who approve content**

**Persona**: Senior editors, editorial board, content directors

**Capabilities**:
- Everything a Moderator can do, plus:
- View pending posts queue
- Approve posts for publication
- Reject posts with feedback
- Request revisions on submissions
- Feature/unfeature articles
- Edit any published post
- Manage tags (create, edit, merge)
- Invite writers to publications

**Restrictions**:
- Cannot manage users or roles
- Cannot access platform settings
- Cannot withdraw funds
- Cannot permanently ban

**How to get this role**: Manual assignment by Admin

**Editorial workflow**:
```
1. Review pending submissions
2. Read full article
3. Check:
   - Quality standards
   - Factual accuracy
   - Policy compliance
   - SEO/formatting
4. Decision:
   - Approve → Published
   - Request revision → Back to author
   - Reject → Closed with reason
5. Optionally feature exceptional content
```

**Review queue interface**:
- Filter by: date, author, tags, word count
- Sort by: newest, oldest, priority
- Bulk actions: approve all, assign to editor
- Quick preview without full load

---

### ADMIN (Level 5)

> **Platform administrators with full management access**

**Persona**: Platform operators, CTO, senior staff

**Capabilities**:
- Everything an Editor can do, plus:
- Manage all users (view, edit, ban)
- Assign/revoke roles (except Owner)
- Permanently ban users
- Delete any content
- Access platform-wide analytics
- Configure platform settings
- Manage publications
- View financial reports

**Restrictions**:
- Cannot withdraw treasury funds
- Cannot transfer ownership
- Cannot upgrade contracts
- Cannot emergency pause

**How to get this role**: Manual assignment by Owner

**Admin dashboard access**:
- `/admin/users` - User management
- `/admin/analytics` - Platform metrics
- `/admin/settings` - Configuration
- `/admin/review` - All review queues
- `/admin/moderation` - All moderation tools

---

### OWNER (Level 6)

> **Platform owner with ultimate authority**

**Persona**: Founder, DAO multisig, governance contract

**Capabilities**:
- Everything an Admin can do, plus:
- Withdraw treasury funds
- Set platform fee percentages
- Transfer ownership
- Upgrade smart contracts
- Emergency pause (halt all operations)
- Configure revenue splits
- Manage API keys

**Restrictions**: None (full access)

**How to get this role**:
- Initial deployer is Owner
- Ownership transfer via `transfer_ownership()`

**Owner-only functions**:
```cairo
// Treasury
fn withdraw_funds(amount: u256, recipient: ContractAddress);
fn set_platform_fee(fee_percentage: u8);

// Governance
fn transfer_ownership(new_owner: ContractAddress);
fn upgrade_contract(new_class_hash: ClassHash);
fn emergency_pause();
fn emergency_unpause();

// Configuration
fn set_contributor_threshold(posts_required: u32);
fn set_session_key_duration(hours: u64);
fn whitelist_paymaster_contract(contract: ContractAddress);
```

---

## Permission Matrix

### Content Permissions

| Permission | Reader | Writer | Contributor | Moderator | Editor | Admin | Owner |
|------------|:------:|:------:|:-----------:|:---------:|:------:|:-----:|:-----:|
| View public content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Like articles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create drafts | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit for review | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Publish immediately | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit own content | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit any content | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete own content | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete any content | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### Editorial Permissions

| Permission | Reader | Writer | Contributor | Moderator | Editor | Admin | Owner |
|------------|:------:|:------:|:-----------:|:---------:|:------:|:-----:|:-----:|
| Approve posts | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Reject posts | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Request revisions | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Feature posts | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage tags | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

### Moderation Permissions

| Permission | Reader | Writer | Contributor | Moderator | Editor | Admin | Owner |
|------------|:------:|:------:|:-----------:|:---------:|:------:|:-----:|:-----:|
| View reports | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Resolve reports | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Hide content | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Temp ban users | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Perma ban users | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### Admin Permissions

| Permission | Reader | Writer | Contributor | Moderator | Editor | Admin | Owner |
|------------|:------:|:------:|:-----------:|:---------:|:------:|:-----:|:-----:|
| Manage users | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage roles | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Access analytics | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Configure settings | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### Owner Permissions

| Permission | Reader | Writer | Contributor | Moderator | Editor | Admin | Owner |
|------------|:------:|:------:|:-----------:|:---------:|:------:|:-----:|:-----:|
| Withdraw funds | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Transfer ownership | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Upgrade contracts | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Emergency pause | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Reputation System

### Earning Points

| Action | Points | Notes |
|--------|--------|-------|
| Post published | +100 | Any published article |
| Post featured | +500 | Editor-selected |
| Comment | +10 | Max 10/day |
| Like received | +5 | Per unique like |
| Subscriber gained | +50 | New follower |
| Valid report | +25 | Moderator-confirmed |
| Spam penalty | -200 | Policy violation |

### Reputation Levels

| Level | Points Required | Title | Perks |
|-------|-----------------|-------|-------|
| 1 | 0-99 | Newcomer | Basic access |
| 2 | 100-499 | Active Writer | Priority review |
| 3 | 500-1,999 | Established | Verified badge eligible |
| 4 | 2,000-9,999 | Veteran | Featured author eligible |
| 5 | 10,000+ | Legend | Platform recognition |

### Badges

Badges are earned through achievements and displayed on profiles:

| Badge | Criteria | Emoji |
|-------|----------|-------|
| First Post | Published first article | 🌱 |
| Prolific Writer | 10+ posts | 📝 |
| Century Club | 100+ posts | 💯 |
| Featured Author | Had a featured article | ⭐ |
| Conversationalist | 100+ comments | 💬 |
| Beloved | 1000+ likes received | ❤️ |
| Early Adopter | Joined in first month | 🎖️ |
| Verified | Completed profile verification | ✅ |
| Top Writer | Monthly top 10 by engagement | 🏆 |
| Premium Author | Has paid subscribers | 💎 |
| Trusted | Contributor role earned | 🔒 |
| Guardian | Active moderator | 🛡️ |

---

## Auto-Promotion

### Writer → Contributor

Users are automatically promoted to Contributor when:
- 5 posts approved by Editors (configurable)
- No policy violations in last 30 days
- Account age > 7 days

```cairo
// RoleRegistry.cairo
fn check_auto_promotion(user: ContractAddress) {
    let approved_posts = self.approved_post_count.read(user);
    let threshold = self.contributor_threshold.read();

    if approved_posts >= threshold {
        self._grant_role(user, ROLE_CONTRIBUTOR);
        emit ContributorPromoted { user };
    }
}
```

### Manual Promotion

Admins can promote users at any time:

```typescript
// Frontend: Admin panel
await roleRegistry.grant_role(userAddress, ROLES.CONTRIBUTOR);
```

---

## Implementation Details

### Frontend Hooks

```typescript
// Check current user's role
const { roleLevel, isLoading } = useRole();

// Check specific user's role
const { roleLevel } = useUserRole(address);

// Get all permissions
const { canPublishImmediately, canApproveContent } = usePermissions();

// Check single permission
const canFeature = useCanPerform('canFeaturePosts');

// Permission-gated component
<RequirePermission permission="canManageUsers">
  <UserManagementPanel />
</RequirePermission>
```

### Contract Queries

```cairo
// Get user role
let role: u8 = role_registry.get_role(user_address);

// Check permission
let can_approve: bool = role_registry.has_permission(user, 'approve_content');

// Grant role (admin only)
role_registry.grant_role(user, ROLE_EDITOR);

// Revoke role (admin only)
role_registry.revoke_role(user);
```

---

## Best Practices

### For Moderators
1. Always check reporter history (prevent abuse)
2. Document decisions with clear reasons
3. Prefer warnings over bans for first offenses
4. Escalate unclear cases to Editors
5. Be consistent in applying guidelines

### For Editors
1. Provide constructive feedback on rejections
2. Feature diverse voices and topics
3. Maintain consistent quality standards
4. Respond to submissions within 48 hours
5. Use revision requests sparingly

### For Admins
1. Audit role changes monthly
2. Review banned accounts quarterly
3. Monitor for privilege escalation
4. Document all significant actions
5. Maintain separation of duties

### For Owners
1. Use multisig for treasury operations
2. Test contract upgrades on testnet first
3. Emergency pause only for critical issues
4. Regular security audits
5. Transparent fee changes (advance notice)
