# User Guide

This guide covers how to use Vauban Blog for different types of users.

---

## Getting Started

### Connecting Your Wallet

1. Click **"Connect Wallet"** in the header
2. Choose your wallet:
   - **ArgentX** - Recommended for beginners
   - **Braavos** - Advanced features
3. Approve the connection in your wallet
4. You are now logged in as a **Reader**

> **No wallet?** You can still read all public content without connecting.

### Your Dashboard

After connecting, access your dashboard at `/dashboard`:

- **My Posts** - Drafts, pending, published
- **Earnings** - Revenue from paid content
- **Reputation** - Points, level, badges
- **Notifications** - Comments, approvals, mentions

---

## For Readers

### Browsing Content

**Homepage** (`/`)
- Featured articles at the top
- Recent posts sorted by date
- Filter by tags, authors, date range

**Search**
- Use the search bar for full-text search
- Filter results by:
  - Content type (articles, authors)
  - Date range
  - Tags
  - Paid/free content

**Author Profiles** (`/authors/[address]`)
- View all posts by an author
- See reputation and badges
- Subscribe to their content

### Interacting with Content

**Liking**
1. Click the heart icon on any article
2. One like per article per user
3. Like count updates immediately

**Commenting**
1. Scroll to the comments section
2. Write your comment (Markdown supported)
3. Click "Post Comment"
4. First time: approve session key (one-time)
5. Subsequent comments: instant, no popups

**Bookmarking** (Coming soon)
- Save articles for later
- Access from dashboard

### Subscribing to Authors

**Free subscriptions**
- Click "Subscribe" on author profile
- Receive notifications for new posts
- No payment required

**Paid subscriptions** (if author offers)
- View subscription tiers
- Select tier and duration
- Pay via wallet transaction
- Access exclusive content

---

## For Writers

### Creating Your First Post

1. Navigate to **Dashboard → New Post**
2. Fill in the editor:
   - **Title** - Catchy, SEO-friendly (max 100 chars)
   - **Content** - Write in Markdown
   - **Tags** - Select or create tags (max 5)
   - **Cover Image** - Upload or paste URL
   - **Excerpt** - Short summary for previews
3. Click **"Save Draft"** to save progress
4. Click **"Submit for Review"** when ready

### Markdown Editor

The editor supports full Markdown with live preview:

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold** and *italic* text

- Bullet lists
- Like this

1. Numbered lists
2. Like this

[Links](https://example.com)

![Images](https://example.com/image.png)

`Inline code` and code blocks:

\`\`\`javascript
const hello = "world";
\`\`\`

> Blockquotes

| Tables | Work |
|--------|------|
| Like   | This |
```

### Draft Management

**Auto-save**
- Drafts save automatically every 30 seconds
- Manual save with Ctrl/Cmd + S
- Recovery modal if browser crashes

**Draft states**
- 📝 Draft - Work in progress
- 🕐 Pending Review - Awaiting Editor
- ✅ Published - Live on the platform
- ❌ Rejected - Needs revision
- 📦 Archived - Hidden from public

### Submission Process

```
┌──────────┐    Submit     ┌─────────────────┐
│  Draft   │──────────────►│ Pending Review  │
└──────────┘               └────────┬────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
             ┌───────────┐  ┌───────────┐  ┌───────────┐
             │ Approved  │  │ Revision  │  │ Rejected  │
             │ (Published│  │ Requested │  │           │
             └───────────┘  └─────┬─────┘  └───────────┘
                                  │
                                  ▼
                           Back to Draft
                           (make changes)
```

**What Editors look for**:
- Clear, error-free writing
- Accurate information
- Proper formatting
- Appropriate tags
- Original content (no plagiarism)

### Editing Published Posts

As a Writer, you can only edit drafts. After publication:
- Request changes through support
- Or ask an Editor to make edits

As a Contributor (Level 2+):
- Edit your own published posts directly
- Changes are immediate
- Edit history is tracked

---

## For Contributors

### Direct Publishing

Contributors bypass the review queue:

1. Write your post as usual
2. Click **"Publish Now"** (not "Submit for Review")
3. Confirm the publication
4. Post is immediately live

**With great power comes responsibility**:
- Your posts reflect on the platform
- Policy violations may result in demotion
- Quality standards still apply

### Earning Contributor Status

**Automatic promotion**:
- Get 5 posts approved by Editors
- No policy violations in 30 days
- Account older than 7 days

**Manual promotion**:
- Request from Admin with portfolio
- Demonstrate expertise in a field
- Contribute valuable content consistently

### Paid Content

Contributors can monetize their work:

**Setting up paid articles**
1. In the editor, toggle "Paid Content"
2. Set price in ETH/STRK
3. Choose access level:
   - **Paywall** - Pay to read full article
   - **Subscriber-only** - For paid subscribers
4. Preview shows for non-payers
5. Publish as usual

**Revenue distribution**:
```
Article Sale ($10)
├── Author: $8.50 (85%)
├── Platform: $1.00 (10%)
└── Referrer: $0.50 (5%)
```

**Withdrawing earnings**:
1. Go to Dashboard → Earnings
2. View pending balance
3. Click "Withdraw"
4. Confirm wallet transaction
5. Funds arrive in ~6 seconds (1 block)

---

## For Moderators

### Accessing Moderation Tools

Navigate to `/admin/moderation`:
- Requires Moderator role (Level 3+)
- Shows pending reports queue
- Quick action buttons

### Handling Reports

**Report types**:
- 🚫 Spam - Commercial, repetitive
- 🎯 Harassment - Personal attacks
- ❌ Misinformation - False claims
- ©️ Copyright - Stolen content
- ❓ Other - General violations

**Review process**:

1. Click on a report to expand
2. View:
   - Reported content (full context)
   - Reporter information
   - Report reason and details
   - Previous reports on same content
3. Investigate:
   - Check reporter history (false reports?)
   - Check content creator history
   - Review community guidelines
4. Take action:
   - **Dismiss** - No violation found
   - **Warning** - First offense, minor issue
   - **Hide** - Remove from public view
   - **Temp Ban** - 1-7 days, repeat offender

### Temp Bans

When issuing a temporary ban:

1. Select ban duration (1-7 days)
2. Provide clear reason
3. User is notified via email/notification
4. User cannot post or comment during ban
5. Ban auto-expires

**Best practices**:
- 1 day: First-time minor violation
- 3 days: Repeat minor or first major
- 7 days: Serious or repeat major

### Comment Moderation

For problematic comments:
- **Hide** - Comment hidden, not deleted
- **Unhide** - Restore if mistakenly hidden
- Hidden comments show "[Hidden by moderator]"
- Author can still see their own hidden comments

---

## For Editors

### Review Queue

Access at `/admin/review`:
- Shows all pending submissions
- Filter by date, author, tags
- Sort by oldest first (FIFO recommended)

### Reviewing Submissions

1. Click a submission to open review panel
2. Read full article (expandable preview)
3. Check:
   - ✅ Writing quality
   - ✅ Factual accuracy
   - ✅ Policy compliance
   - ✅ Appropriate tags
   - ✅ Proper formatting
4. Decision:

**Approve**
- Post goes live immediately
- Author notified
- Counts toward their promotion

**Request Revision**
- Write specific feedback
- Post returns to draft status
- Author can revise and resubmit

**Reject**
- Provide clear reason
- Post marked as rejected
- Author can appeal to Admin

### Featuring Content

Outstanding content can be featured:

1. Find a published article
2. Click "Feature" button
3. Article appears in:
   - Featured section on homepage
   - Featured articles carousel
   - Author profile highlight

**Feature criteria**:
- Exceptional quality
- Timely/relevant topic
- High engagement
- Diverse perspectives

### Tag Management

Editors maintain the tag system:

**Creating tags**
- Add new tags as needed
- Use lowercase, hyphenated names
- Provide clear description

**Merging tags**
- Combine duplicate/similar tags
- All posts update automatically

**Deprecating tags**
- Hide outdated tags from creation
- Existing posts keep the tag

---

## For Admins

### User Management

Access at `/admin/users`:
- Search users by address or username
- View user details and history
- Manage roles and permissions

**Actions**:
- View profile and activity
- Change role (grant/revoke)
- Issue permanent ban
- Reset account flags

### Analytics Dashboard

Access at `/admin/analytics`:
- Platform metrics overview
- Content performance
- User growth
- Revenue reports

**Key metrics**:
- Daily/weekly/monthly active users
- Posts published per period
- Average engagement rates
- Revenue and withdrawals

### Platform Settings

Configuration options:
- Contributor threshold (posts for auto-promotion)
- Session key duration
- Rate limits
- Feature flags

---

## Common Tasks

### Changing Your Profile

1. Go to Dashboard → Settings
2. Update:
   - Display name
   - Bio (Markdown supported)
   - Profile picture (IPFS upload)
   - Social links
3. Save changes (wallet signature required)

### Reporting Content

1. Click the "..." menu on any post/comment
2. Select "Report"
3. Choose reason:
   - Spam
   - Harassment
   - Misinformation
   - Copyright
   - Other
4. Add details (optional but helpful)
5. Submit report

### Session Keys

Session keys enable gasless interactions:

**First-time setup**:
1. Click "Comment" on any article
2. Wallet popup asks to sign session key
3. Approve (valid for 7 days)
4. All future comments are free

**Revoking session keys**:
1. Go to Dashboard → Security
2. View active session keys
3. Click "Revoke" to invalidate

**Why session keys?**
- No wallet popup for every comment
- Paymaster sponsors gas fees
- Limited scope (comments only)
- Time-limited (auto-expires)

---

## Troubleshooting

### Wallet won't connect
- Refresh the page
- Check wallet extension is installed
- Try a different browser
- Ensure you are on Starknet network

### Transaction failed
- Check wallet has ETH for gas (if not using session key)
- Try again in a few seconds
- Check Madara RPC status

### Content not loading
- IPFS gateway may be slow
- Refresh to try Arweave fallback
- Check browser console for errors

### Session key not working
- Key may have expired (7 days)
- Revoke and create new key
- Clear browser cache

### Comment not appearing
- Wait for block confirmation (~6s)
- Refresh the page
- Check transaction in wallet history

---

## Keyboard Shortcuts

### Editor

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + S | Save draft |
| Ctrl/Cmd + Enter | Submit/Publish |
| Ctrl/Cmd + B | Bold |
| Ctrl/Cmd + I | Italic |
| Ctrl/Cmd + K | Insert link |
| Ctrl/Cmd + Shift + I | Insert image |
| Ctrl/Cmd + ` | Code block |
| Tab | Indent |
| Shift + Tab | Outdent |

### Navigation

| Shortcut | Action |
|----------|--------|
| / | Focus search |
| Esc | Close modal/menu |
| ? | Show shortcuts help |
