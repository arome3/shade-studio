/** Type declarations for circomlibjs (no @types package available) */
declare module 'circomlibjs' {
  export function buildPoseidon(): Promise<PoseidonFunction>;

  interface FieldElement extends Uint8Array {}

  interface PoseidonFunction {
    (...inputs: bigint[]): FieldElement;
    F: {
      toString(val: FieldElement, radix?: number): string;
      toObject(val: FieldElement): bigint;
    };
  }
}
