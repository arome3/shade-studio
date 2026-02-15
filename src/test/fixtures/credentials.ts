/**
 * ZK credential test fixtures.
 *
 * Factory functions for ZKProof, OnChainCredential, and UICredential
 * with valid shapes matching the Groth16/BN128 proof structure.
 */

import type { ZKProof, ZKCircuit, OnChainCredential } from '@/types/zk';
import type { UICredential, CredentialSource } from '@/types/credentials';

let fixtureCounter = 0;

export function createMockZKProof(overrides?: Partial<ZKProof>): ZKProof {
  const id = `proof-${++fixtureCounter}`;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  return {
    id,
    circuit: 'verified-builder' as ZKCircuit,
    proof: {
      pi_a: ['12345678901234567890', '98765432109876543210', '1'],
      pi_b: [
        ['11111111111111111111', '22222222222222222222'],
        ['33333333333333333333', '44444444444444444444'],
        ['1', '0'],
      ],
      pi_c: ['55555555555555555555', '66666666666666666666', '1'],
      protocol: 'groth16',
      curve: 'bn128',
    },
    publicSignals: ['1', '30', String(Math.floor(Date.now() / 1000))],
    status: 'ready',
    generatedAt: now,
    expiresAt: expires,
    ...overrides,
  };
}

/**
 * Create an expired proof for testing pruning logic.
 */
export function createExpiredProof(overrides?: Partial<ZKProof>): ZKProof {
  return createMockZKProof({
    status: 'expired',
    expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
    ...overrides,
  });
}

export function createMockOnChainCredential(
  overrides?: Partial<OnChainCredential>
): OnChainCredential {
  const id = `cred-${++fixtureCounter}`;
  const now = Math.floor(Date.now() / 1000);

  return {
    id,
    owner: 'test.near',
    circuitType: 'verified-builder' as ZKCircuit,
    publicSignals: ['1', '30', String(now)],
    verifiedAt: now,
    expiresAt: now + 30 * 24 * 60 * 60, // 30 days
    claim: 'Verified builder with 30+ active days',
    ...overrides,
  };
}

export function createMockUICredential(
  source: CredentialSource = 'local',
  circuit: ZKCircuit = 'verified-builder',
  overrides?: Partial<UICredential>
): UICredential {
  const id = `ui-cred-${++fixtureCounter}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return {
    id,
    circuit,
    source,
    status: source === 'on-chain' ? 'on-chain' : 'ready',
    createdAt: now,
    expiresAt,
    isExpired: false,
    publicSignals: ['1', '30', String(Math.floor(Date.now() / 1000))],
    claim: `Test ${circuit} credential`,
    owner: 'test.near',
    proof: source === 'local' ? createMockZKProof({ circuit }) : undefined,
    onChainCredential:
      source === 'on-chain'
        ? createMockOnChainCredential({ circuitType: circuit })
        : undefined,
    ...overrides,
  };
}

/**
 * Reset the fixture counter (call in beforeEach for deterministic IDs).
 */
export function resetCredentialFixtures() {
  fixtureCounter = 0;
}
