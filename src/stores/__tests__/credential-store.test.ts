import { describe, it, expect, beforeEach } from 'vitest';
import { useCredentialStore } from '../credential-store';
import type { OnChainCredential } from '@/types/zk';

function makeCred(id: string, owner = 'alice.testnet'): OnChainCredential {
  return {
    id,
    owner,
    circuitType: 'verified-builder',
    publicSignals: ['1', '2'],
    verifiedAt: 1700000000,
    expiresAt: 1702592000,
  };
}

describe('credential-store', () => {
  beforeEach(() => {
    useCredentialStore.getState().reset();
  });

  it('starts with empty state', () => {
    const state = useCredentialStore.getState();
    expect(state.credentials).toEqual({});
    expect(state.credentialOrder).toEqual([]);
    expect(state.lastFetchedAt).toBeNull();
    expect(state.isFetching).toBe(false);
    expect(state.error).toBeNull();
  });

  it('addCredential adds to record and order', () => {
    const cred = makeCred('cred-1');
    useCredentialStore.getState().addCredential(cred);

    const state = useCredentialStore.getState();
    expect(state.credentials['cred-1']).toEqual(cred);
    expect(state.credentialOrder).toEqual(['cred-1']);
  });

  it('addCredential prepends to order (newest first)', () => {
    useCredentialStore.getState().addCredential(makeCred('cred-1'));
    useCredentialStore.getState().addCredential(makeCred('cred-2'));

    const state = useCredentialStore.getState();
    expect(state.credentialOrder).toEqual(['cred-2', 'cred-1']);
  });

  it('removeCredential removes from record and order', () => {
    useCredentialStore.getState().addCredential(makeCred('cred-1'));
    useCredentialStore.getState().addCredential(makeCred('cred-2'));
    useCredentialStore.getState().removeCredential('cred-1');

    const state = useCredentialStore.getState();
    expect(state.credentials['cred-1']).toBeUndefined();
    expect(state.credentialOrder).toEqual(['cred-2']);
  });

  it('setCredentials replaces all credentials', () => {
    useCredentialStore.getState().addCredential(makeCred('old'));

    const newCreds = [makeCred('new-1'), makeCred('new-2')];
    useCredentialStore.getState().setCredentials(newCreds);

    const state = useCredentialStore.getState();
    expect(Object.keys(state.credentials)).toEqual(['new-1', 'new-2']);
    expect(state.credentialOrder).toEqual(['new-1', 'new-2']);
    expect(state.lastFetchedAt).toBeGreaterThan(0);
  });

  it('setFetching updates isFetching and clears error', () => {
    useCredentialStore.getState().setError('some error');
    useCredentialStore.getState().setFetching(true);

    const state = useCredentialStore.getState();
    expect(state.isFetching).toBe(true);
    expect(state.error).toBeNull();
  });

  it('setError updates error and clears fetching', () => {
    useCredentialStore.getState().setFetching(true);
    useCredentialStore.getState().setError('network error');

    const state = useCredentialStore.getState();
    expect(state.error).toBe('network error');
    expect(state.isFetching).toBe(false);
  });

  it('clearError clears error', () => {
    useCredentialStore.getState().setError('oops');
    useCredentialStore.getState().clearError();

    expect(useCredentialStore.getState().error).toBeNull();
  });

  it('reset returns to initial state', () => {
    useCredentialStore.getState().addCredential(makeCred('cred-1'));
    useCredentialStore.getState().setError('bad');
    useCredentialStore.getState().reset();

    const state = useCredentialStore.getState();
    expect(state.credentials).toEqual({});
    expect(state.credentialOrder).toEqual([]);
    expect(state.error).toBeNull();
  });
});
