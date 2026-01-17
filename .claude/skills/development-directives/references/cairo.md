# Cairo & Starknet Development Standards

> Reference for Starknet smart contract development

---

## Project Structure

```
contracts/
├── Scarb.toml              # Package manifest
├── src/
│   ├── lib.cairo           # Library root
│   ├── contract_name.cairo # Contract implementation
│   └── tests/              # Test modules
│       └── test_contract.cairo
└── scripts/
    └── deploy.ts           # Deployment scripts
```

---

## Scarb Configuration

```toml
# Scarb.toml
[package]
name = "my_contract"
version = "0.1.0"
edition = "2024_07"

[dependencies]
starknet = "2.8.0"
openzeppelin = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v0.17.0" }

[dev-dependencies]
snforge_std = { git = "https://github.com/foundry-rs/starknet-foundry", tag = "v0.31.0" }

[[target.starknet-contract]]
sierra = true
casm = true

[scripts]
test = "snforge test"
build = "scarb build"
```

---

## Contract Structure

### Standard Contract Pattern

```cairo
#[starknet::interface]
pub trait IMyContract<TContractState> {
    fn get_value(self: @TContractState) -> u256;
    fn set_value(ref self: TContractState, new_value: u256);
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256);
}

#[starknet::contract]
pub mod MyContract {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin::access::ownable::OwnableComponent;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableTwoStepImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    // ═══════════════════════════════════════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════════════════════════════════════
    
    #[storage]
    struct Storage {
        value: u256,
        balances: LegacyMap<ContractAddress, u256>,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════
    
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ValueChanged: ValueChanged,
        Transfer: Transfer,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ValueChanged {
        #[key]
        pub caller: ContractAddress,
        pub old_value: u256,
        pub new_value: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        #[key]
        pub from: ContractAddress,
        #[key]
        pub to: ContractAddress,
        pub amount: u256,
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════
    
    pub mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'Zero address not allowed';
        pub const INSUFFICIENT_BALANCE: felt252 = 'Insufficient balance';
        pub const OVERFLOW: felt252 = 'Arithmetic overflow';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════
    
    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, initial_value: u256) {
        assert(owner.is_non_zero(), Errors::ZERO_ADDRESS);
        self.ownable.initializer(owner);
        self.value.write(initial_value);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    #[abi(embed_v0)]
    impl MyContractImpl of super::IMyContract<ContractState> {
        fn get_value(self: @ContractState) -> u256 {
            self.value.read()
        }

        fn set_value(ref self: ContractState, new_value: u256) {
            self.ownable.assert_only_owner();
            
            let old_value = self.value.read();
            self.value.write(new_value);
            
            // ✅ MANDATORY: Emit event for all state changes
            self.emit(ValueChanged {
                caller: get_caller_address(),
                old_value,
                new_value,
            });
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            assert(recipient.is_non_zero(), Errors::ZERO_ADDRESS);
            
            let caller = get_caller_address();
            let sender_balance = self.balances.read(caller);
            
            // ✅ MANDATORY: Explicit overflow check
            assert(sender_balance >= amount, Errors::INSUFFICIENT_BALANCE);
            
            // Effects
            self.balances.write(caller, sender_balance - amount);
            
            let recipient_balance = self.balances.read(recipient);
            // Check for overflow on addition
            let new_balance = recipient_balance + amount;
            assert(new_balance >= recipient_balance, Errors::OVERFLOW);
            self.balances.write(recipient, new_balance);
            
            // ✅ MANDATORY: Emit event
            self.emit(Transfer { from: caller, to: recipient, amount });
        }
    }
}
```

---

## Critical Requirements

### 1. Event Emission — Mandatory for All State Changes

```cairo
// ❌ FORBIDDEN — State change without event
fn set_value(ref self: ContractState, new_value: u256) {
    self.value.write(new_value);  // No event emitted!
}

// ✅ CORRECT — Always emit events
fn set_value(ref self: ContractState, new_value: u256) {
    let old_value = self.value.read();
    self.value.write(new_value);
    self.emit(ValueChanged { old_value, new_value });
}
```

### 2. Explicit Overflow Handling

```cairo
// ❌ DANGEROUS — Silent overflow possible
fn add_balance(ref self: ContractState, amount: u256) {
    let current = self.balance.read();
    self.balance.write(current + amount);  // Could overflow!
}

// ✅ CORRECT — Explicit overflow check
fn add_balance(ref self: ContractState, amount: u256) {
    let current = self.balance.read();
    let new_balance = current + amount;
    assert(new_balance >= current, 'Overflow');
    self.balance.write(new_balance);
}
```

### 3. Storage Optimization

```cairo
// ❌ INEFFICIENT — Multiple storage writes
fn update_user(ref self: ContractState, user: ContractAddress, a: u256, b: u256, c: u256) {
    self.user_a.write(user, a);  // Storage write 1
    self.user_b.write(user, b);  // Storage write 2
    self.user_c.write(user, c);  // Storage write 3
}

// ✅ OPTIMIZED — Pack into struct, single write
#[derive(Drop, Serde, starknet::Store)]
struct UserData {
    a: u256,
    b: u256,
    c: u256,
}

fn update_user(ref self: ContractState, user: ContractAddress, data: UserData) {
    self.users.write(user, data);  // Single storage write
}
```

### 4. Access Control

```cairo
// ❌ FORBIDDEN — No access control
fn admin_function(ref self: ContractState) {
    // Anyone can call!
}

// ✅ CORRECT — Use OpenZeppelin components
use openzeppelin::access::ownable::OwnableComponent;

fn admin_function(ref self: ContractState) {
    self.ownable.assert_only_owner();
    // Protected logic
}
```

---

## Testing with snforge

### Test Structure

```cairo
#[cfg(test)]
mod tests {
    use snforge_std::{
        declare, ContractClassTrait, DeclareResultTrait,
        start_cheat_caller_address, stop_cheat_caller_address,
        spy_events, EventSpyAssertionsTrait,
    };
    use starknet::{ContractAddress, contract_address_const};
    use super::{IMyContractDispatcher, IMyContractDispatcherTrait};
    use super::MyContract::{Event, ValueChanged};

    fn OWNER() -> ContractAddress {
        contract_address_const::<'OWNER'>()
    }

    fn USER() -> ContractAddress {
        contract_address_const::<'USER'>()
    }

    fn deploy() -> IMyContractDispatcher {
        let contract = declare("MyContract").unwrap().contract_class();
        let (address, _) = contract.deploy(@array![OWNER().into(), 100]).unwrap();
        IMyContractDispatcher { contract_address: address }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HAPPY PATH TESTS
    // ═══════════════════════════════════════════════════════════════════════
    
    #[test]
    fn test_initial_value() {
        let contract = deploy();
        assert_eq!(contract.get_value(), 100);
    }

    #[test]
    fn test_set_value_as_owner() {
        let contract = deploy();
        
        start_cheat_caller_address(contract.contract_address, OWNER());
        contract.set_value(200);
        stop_cheat_caller_address(contract.contract_address);
        
        assert_eq!(contract.get_value(), 200);
    }

    #[test]
    fn test_set_value_emits_event() {
        let contract = deploy();
        let mut spy = spy_events();
        
        start_cheat_caller_address(contract.contract_address, OWNER());
        contract.set_value(200);
        stop_cheat_caller_address(contract.contract_address);
        
        spy.assert_emitted(@array![
            (
                contract.contract_address,
                Event::ValueChanged(ValueChanged {
                    caller: OWNER(),
                    old_value: 100,
                    new_value: 200,
                })
            )
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ERROR CASE TESTS
    // ═══════════════════════════════════════════════════════════════════════
    
    #[test]
    #[should_panic(expected: 'Caller is not the owner')]
    fn test_set_value_not_owner_reverts() {
        let contract = deploy();
        
        start_cheat_caller_address(contract.contract_address, USER());
        contract.set_value(200);  // Should panic
    }

    #[test]
    #[should_panic(expected: 'Insufficient balance')]
    fn test_transfer_insufficient_balance_reverts() {
        let contract = deploy();
        
        start_cheat_caller_address(contract.contract_address, USER());
        contract.transfer(OWNER(), 1000);  // User has 0 balance
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EDGE CASE TESTS
    // ═══════════════════════════════════════════════════════════════════════
    
    #[test]
    fn test_transfer_zero_amount() {
        let contract = deploy();
        
        start_cheat_caller_address(contract.contract_address, USER());
        contract.transfer(OWNER(), 0);  // Should succeed (no-op)
    }

    #[test]
    #[should_panic(expected: 'Zero address not allowed')]
    fn test_transfer_to_zero_address_reverts() {
        let contract = deploy();
        
        start_cheat_caller_address(contract.contract_address, USER());
        contract.transfer(contract_address_const::<0>(), 100);
    }
}
```

---

## Commands

```bash
# Build contracts
scarb build

# Run all tests
snforge test

# Run specific test
snforge test test_initial_value

# Run tests with gas reporting
snforge test --gas-report

# Deploy (via starkli)
starkli deploy <CLASS_HASH> <CONSTRUCTOR_ARGS>

# Verify contract
starkli verify <CONTRACT_ADDRESS> --network mainnet
```

---

## Security Checklist

Before deployment:

```
□ All functions have appropriate access control
□ All state changes emit events
□ All arithmetic operations handle overflow
□ Storage is optimized (packed structs where possible)
□ Reentrancy is considered (CEI pattern)
□ Zero address checks on all address inputs
□ Test coverage includes all error paths
□ Gas costs are acceptable
□ Upgrade path is defined (if upgradeable)
```

---

*Apply these standards to all Cairo code without exception.*
