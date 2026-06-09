#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

fn setup() -> (Env, TlaasAnchorClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, TlaasAnchor);
    let client = TlaasAnchorClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

#[test]
fn anchor_then_read_roundtrips() {
    let (env, client, _admin) = setup();
    let month = String::from_str(&env, "2026-06");
    let cid = String::from_str(&env, "ipfs://QmXoyExample");
    let hash = BytesN::from_array(&env, &[7u8; 32]);

    client.anchor_record(&404u32, &month, &cid, &hash);

    let rec = client.get_anchor_record(&404u32, &month).unwrap();
    assert_eq!(rec.data_hash, hash);
    assert_eq!(rec.ipfs_cid, cid);
}

#[test]
fn unanchored_period_reads_none() {
    let (env, client, _admin) = setup();
    let month = String::from_str(&env, "2099-01");
    assert_eq!(client.get_anchor_record(&1u32, &month), None);
}

#[test]
#[should_panic] // Error::AlreadyAnchored — immutability proven
fn double_anchor_same_period_fails() {
    let (env, client, _admin) = setup();
    let month = String::from_str(&env, "2026-06");
    let cid = String::from_str(&env, "ipfs://a");
    let hash = BytesN::from_array(&env, &[1u8; 32]);
    client.anchor_record(&1u32, &month, &cid, &hash);
    client.anchor_record(&1u32, &month, &cid, &hash); // panics
}

#[test]
fn tenant_admin_registry_roundtrips() {
    let (env, client, _admin) = setup();
    let tadmin = Address::generate(&env);
    client.set_tenant_admin(&5u32, &tadmin);
    assert_eq!(client.get_tenant_admin(&5u32), Some(tadmin));
    assert_eq!(client.get_tenant_admin(&999u32), None);
}
