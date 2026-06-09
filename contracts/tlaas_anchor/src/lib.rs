#![no_std]
//! TLaaS Anchor — immutable settlement anchoring for the trustless ledger.
//!
//! Design (carried from the Known-Gaps "Close-of-Period" decision):
//!   * `anchor_record` writes ONE immutable fingerprint per (tenant, month).
//!     A second write to the same period fails — history can't be rewritten.
//!   * `get_anchor_record` is the read the frontend verification engine calls.
//!   * The tenant-admin registry (`set/get_tenant_admin`) backs the Phase 6
//!     governance signature checks. It's separate from anchoring auth so the
//!     platform server (instance admin) can broadcast Close-of-Period writes.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short,
    Address, BytesN, Env, String, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    AlreadyAnchored = 3,
}

// Instance admin (the platform server / deployer) lives in instance storage.
const ADMIN: Symbol = symbol_short!("ADMIN");

#[contracttype]
pub enum DataKey {
    Anchor(u32, String), // (tenant_id, month_key) -> AnchorRecord
    TenantAdmin(u32),    // tenant_id -> Address
}

#[contracttype]
#[derive(Clone)]
pub struct AnchorRecord {
    pub ipfs_cid: String,
    pub data_hash: BytesN<32>,
}

#[contract]
pub struct TlaasAnchor;

#[contractimpl]
impl TlaasAnchor {
    /// One-time setup: records the instance admin (the broadcasting server).
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&ADMIN) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&ADMIN, &admin);
        Ok(())
    }

    fn admin(env: &Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&ADMIN)
            .ok_or(Error::NotInitialized)
    }

    /// Anchor a settled period. Immutable: a second write to the same
    /// (tenant_id, month_key) returns AlreadyAnchored.
    pub fn anchor_record(
        env: Env,
        tenant_id: u32,
        month_key: String,
        ipfs_cid: String,
        data_hash: BytesN<32>,
    ) -> Result<(), Error> {
        Self::admin(&env)?.require_auth();

        let key = DataKey::Anchor(tenant_id, month_key.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyAnchored);
        }

        env.storage().persistent().set(
            &key,
            &AnchorRecord {
                ipfs_cid: ipfs_cid.clone(),
                data_hash: data_hash.clone(),
            },
        );

        // Event the Phase 4 indexer consumes. Value tuple order is the contract
        // the indexer relies on: (tenant_id, month_key, ipfs_cid, data_hash).
        env.events().publish(
            (symbol_short!("anchor"),),
            (tenant_id, month_key, ipfs_cid, data_hash),
        );
        Ok(())
    }

    /// Read accessor for the verification engine. Returns None if not anchored.
    pub fn get_anchor_record(env: Env, tenant_id: u32, month_key: String) -> Option<AnchorRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Anchor(tenant_id, month_key))
    }

    /// Governance registry (used by Phase 6). Only the instance admin may set.
    pub fn set_tenant_admin(env: Env, tenant_id: u32, tenant_admin: Address) -> Result<(), Error> {
        Self::admin(&env)?.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::TenantAdmin(tenant_id), &tenant_admin);
        Ok(())
    }

    pub fn get_tenant_admin(env: Env, tenant_id: u32) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::TenantAdmin(tenant_id))
    }
}

mod test;
