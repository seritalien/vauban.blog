---
title: "Web3 Without the Friction: How We Made Blockchain Invisible"
slug: web3-without-the-friction
excerpt: "No gas fees. No constant wallet popups. Just write, publish, and engage. Here is how we made it possible."
author: "Vauban Team"
tags: ["ux", "web3", "session-keys", "gasless", "account-abstraction"]
coverImage: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1200&h=630&fit=crop"
publishedAt: 2026-01-25
featured: false
---

# Web3 Without the Friction: How We Made Blockchain Invisible

The year is 2022. You want to leave a comment on a blockchain-based social platform. Here's your experience:

1. Install a wallet extension
2. Create an account with a 12-word phrase you must never lose
3. Buy some cryptocurrency on an exchange
4. Transfer it to your wallet (pay a fee)
5. Wait for confirmation
6. Return to the platform
7. Approve the transaction (wallet popup)
8. Pay gas fee ($0.50-$50 depending on network congestion)
9. Wait for transaction confirmation
10. Your comment appears

For a comment. A single comment.

No wonder Web3 never went mainstream.

## The UX Problem We Solved

When we built Vauban, we had a rule: **if your grandmother can't use it, we've failed.**

This meant eliminating:
- ❌ Gas fees for everyday actions
- ❌ Wallet popups for every interaction
- ❌ Cryptocurrency purchases just to participate
- ❌ Complex transaction confirmations
- ❌ Waiting for block confirmations

Here's what we achieved:

| Action | Traditional Web3 | Vauban |
|--------|------------------|--------|
| First comment | Wallet + Gas + Confirm | One-time authorization |
| Subsequent comments | Wallet + Gas + Confirm | Just click "Post" |
| Liking an article | Wallet + Gas | Just click "Like" |
| Following an author | Wallet + Gas | Just click "Follow" |
| Cost to user | $0.10-$5.00+ per action | $0.00 |

The blockchain is still there. The decentralization is real. But users don't need to know or care.

## How It Works: Session Keys

The magic behind Vauban's frictionless UX is **session keys**—a feature enabled by Starknet's native account abstraction.

### The Traditional Model

In traditional crypto, your wallet holds a private key. Every action requires that key to sign a transaction. This means:

```
User clicks "Like" →
  Wallet popup: "Sign this transaction?" →
    User clicks "Confirm" →
      Transaction sent →
        Wait for confirmation →
          Like recorded
```

Every. Single. Time.

### The Session Key Model

Vauban works differently:

```
First interaction:
  Wallet popup: "Authorize session key for 7 days?"
    User clicks "Authorize" (one time)

All subsequent interactions:
  User clicks "Like" →
    Session key signs automatically →
      Like recorded instantly
```

One authorization, unlimited frictionless actions for a week.

### What's a Session Key?

A session key is a temporary, limited-permission key stored in your browser. Think of it like a hotel key card:

- **Limited scope**: Can only open your room (can only perform social actions)
- **Time-limited**: Expires after checkout (expires after 7 days)
- **Revocable**: Front desk can deactivate it (you can revoke it anytime)
- **Not your main key**: Losing it doesn't mean losing everything (losing it doesn't expose your wallet)

When you authorize a session key, you're saying: "For the next 7 days, this browser can comment, like, and follow on my behalf."

The session key can't:
- Transfer your money
- Change your account settings
- Interact with other applications
- Do anything outside its narrow scope

### Technical Implementation

For the curious, here's what happens under the hood:

```typescript
// When you authorize a session key
const sessionKey = await wallet.signSessionKey({
  duration: 7 * 24 * 60 * 60,  // 7 days in seconds
  allowedContracts: [SOCIAL_CONTRACT_ADDRESS],
  allowedMethods: ['add_comment', 'like_post', 'follow_author'],
  maxGasPerTransaction: 100000
});

// Stored locally in browser
localStorage.setItem('vauban_session_key', sessionKey);

// When you like a post
async function likePost(postId) {
  const sessionKey = localStorage.getItem('vauban_session_key');

  // Session key signs the transaction (no wallet popup)
  const signature = await sessionKey.sign({
    contract: SOCIAL_CONTRACT_ADDRESS,
    method: 'like_post',
    args: [postId]
  });

  // Send to blockchain
  await starknet.execute({
    ...signature,
    paymaster: PAYMASTER_ADDRESS  // We pay the gas
  });
}
```

## How It Works: Paymaster (Gasless Transactions)

Even with session keys, blockchain transactions cost gas. In traditional Web3, users pay this.

On Vauban, we pay it for you through our **Paymaster** contract.

### What's a Paymaster?

A Paymaster is a smart contract that sponsors gas fees on behalf of users. It's like a generous friend who picks up the tab at dinner.

When you comment:
1. Your session key signs the transaction
2. Transaction is sent to the Paymaster
3. Paymaster verifies it's a valid social action
4. Paymaster pays the gas fee from its balance
5. Transaction executes
6. You paid nothing

### Why Can We Afford This?

Social interactions are incredibly cheap on our L3:

| Action | Gas Cost |
|--------|----------|
| Comment | ~$0.0001 |
| Like | ~$0.00005 |
| Follow | ~$0.00005 |

For $10, we can sponsor 100,000 comments. That's not a typo.

Running our own L3 means we control gas prices. Unlike Ethereum mainnet where gas can spike to dollars, our network maintains stable, negligible costs.

### Paymaster Safeguards

To prevent abuse, the Paymaster has limits:

- **Whitelist**: Only sponsors transactions to the Social contract
- **Rate limits**: Maximum sponsored transactions per user per day
- **Budget caps**: Daily spending limits

If someone tries to exploit free transactions, the Paymaster refuses to sponsor them. Normal users never hit these limits.

## The User Experience Flow

Let's walk through a new user's experience:

### First Visit (No Wallet)

1. Browse homepage, read articles
2. No wallet needed
3. Full content access for public articles

### First Interaction (Connect Wallet)

1. Click "Like" on an article
2. Prompt: "Connect wallet to interact"
3. Choose ArgentX or Braavos
4. Approve connection (standard Web3)
5. One-time session key authorization
6. Like is recorded

### Subsequent Interactions

1. Click "Comment"
2. Write comment
3. Click "Post"
4. Comment appears instantly
5. No popup, no fee, no friction

This is the experience of Medium or Twitter, powered by blockchain.

## Account Abstraction: The Enabler

None of this would be possible on Bitcoin or old Ethereum. Starknet's **native account abstraction** makes it work.

### What's Account Abstraction?

In traditional blockchains, accounts are simple: they hold a balance and can sign transactions. That's it.

With account abstraction, accounts are smart contracts themselves. They can:

- **Define custom validation logic**: "Accept transactions from my session keys"
- **Pay for gas in any token**: "Deduct from my USDC balance"
- **Delegate to other keys**: "Let this browser act on my behalf"
- **Set spending limits**: "Max 0.1 ETH per transaction"
- **Require multi-sig**: "Need 2 of 3 keys to approve"

This flexibility enables session keys and paymaster sponsorship natively, without hacky workarounds.

### Why Other Platforms Struggle

Ethereum is retrofitting account abstraction (ERC-4337). It works, but it's complex and expensive—transactions cost more because they require extra contracts.

Solana has a different architecture that makes session keys complicated.

Starknet was designed with account abstraction from day one. Session keys and paymasters are first-class features, not afterthoughts.

## Security Considerations

"Wait," you might think, "a key that signs transactions without my approval sounds dangerous."

Here's why it's safe:

### Limited Scope

Session keys can ONLY:
- Call the Social contract
- Execute specific methods (comment, like, follow)
- Within gas limits

They CANNOT:
- Transfer your funds
- Interact with DeFi protocols
- Change your account settings
- Sign arbitrary messages

Even if someone steals your session key, the worst they can do is like articles on your behalf.

### Time Limited

Session keys expire after 7 days. Even if compromised, the exposure window is limited.

### Revocable

You can revoke session keys anytime:

```
Dashboard → Security → Active Session Keys → Revoke
```

Instant invalidation. The old key becomes useless.

### Transparent

Every session key authorization is logged on-chain. You can audit exactly what permissions you've granted.

## What This Means for Web3 Adoption

The crypto industry has spent a decade trying to onboard "the next billion users." It's failed because the UX is hostile.

Vauban proves a different approach:

1. **Don't ask users to understand blockchain** - Just make it work
2. **Don't ask users to pay for gas** - Sponsor it if the economics make sense
3. **Don't interrupt users constantly** - One permission, long-lasting access
4. **Don't compromise on decentralization** - Still fully on-chain, still verifiable

The result: an app that feels like Web2 but has Web3 properties. Users get ownership and permanence without the complexity.

## Try It Yourself

The best way to understand is to experience it:

1. Connect your wallet
2. Authorize the session key (one time)
3. Like this article
4. Comment below
5. Notice: no popups, no fees, instant

That's the Vauban experience. Decentralized, permanent, and actually usable.

---

## For Developers

Want to implement similar UX in your dApp? See our:
- [Session Key Documentation](/docs/api-reference#sessionkeymanager-contract)
- [Paymaster Integration Guide](/docs/smart-contracts#paymaster)
- [Open Source Contracts](https://github.com/vauban/contracts)

---

*This article was published using the same frictionless system it describes. No gas was paid by the author. Full decentralization, zero friction.*
