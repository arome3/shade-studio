/**
 * Pre-generate a demo ZK proof for the hackathon.
 * Outputs a JSON file that can be imported directly.
 */
import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";
import path from "path";
import { readFile, writeFile } from "fs/promises";
import { nanoid } from "nanoid";

const PROJECT = "/Users/arome/Downloads/Web3/shade_studio";
const WASM = path.join(PROJECT, "public/circuits/verified-builder.wasm");
const ZKEY = path.join(PROJECT, "public/circuits/verified-builder.zkey");
const VKEY_PATH = path.join(PROJECT, "public/circuits/verified-builder.vkey.json");
const OUTPUT = path.join(PROJECT, "public/demo-proof.json");

const MAX_DAYS = 30, MERKLE_DEPTH = 20, MIN_DAYS = 5, NUM_ACTIVITIES = 10;

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;

  // Hash timestamps
  const timestamps = Array.from({length: NUM_ACTIVITIES}, (_, i) => now - i * DAY);
  const hashedLeaves = timestamps.map(ts => F.toObject(poseidon([BigInt(ts)])));

  // Sparse Merkle tree
  const zeroH = [BigInt(0)];
  for (let d = 0; d < MERKLE_DEPTH; d++) zeroH.push(F.toObject(poseidon([zeroH[d], zeroH[d]])));
  const levels = Array.from({length: MERKLE_DEPTH + 1}, () => new Map());
  hashedLeaves.forEach((h, i) => levels[0].set(i, h));
  for (let d = 0; d < MERKLE_DEPTH; d++) {
    const parents = new Set();
    for (const idx of levels[d].keys()) parents.add(Math.floor(idx / 2));
    for (const pi of parents) {
      const l = levels[d].get(pi*2) ?? zeroH[d], r = levels[d].get(pi*2+1) ?? zeroH[d];
      levels[d+1].set(pi, F.toObject(poseidon([l, r])));
    }
  }
  const root = (levels[MERKLE_DEPTH].get(0) ?? zeroH[MERKLE_DEPTH]).toString();

  // Extract proofs + build inputs
  const activityDates = hashedLeaves.map(h => F.toString(poseidon([h]), 10));
  // Re-hash correctly: input-preparation hashes raw timestamps
  const correctHashedDates = timestamps.map(ts => F.toString(poseidon([BigInt(ts)]), 10));
  
  const pathElements = [], pathIndices = [];
  for (let li = 0; li < NUM_ACTIVITIES; li++) {
    const sibs = [], pis = [];
    let idx = li;
    for (let d = 0; d < MERKLE_DEPTH; d++) {
      const sibIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      sibs.push((levels[d].get(sibIdx) ?? zeroH[d]).toString());
      pis.push(idx % 2);
      idx = Math.floor(idx / 2);
    }
    pathElements.push(sibs);
    pathIndices.push(pis);
  }
  while (pathElements.length < MAX_DAYS) {
    pathElements.push(Array(MERKLE_DEPTH).fill("0"));
    pathIndices.push(Array(MERKLE_DEPTH).fill(0));
  }
  const paddedDates = [...correctHashedDates];
  while (paddedDates.length < MAX_DAYS) paddedDates.push("0");

  console.log("Generating proof...");
  const t0 = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    { activityRoot: root, minDays: MIN_DAYS, currentTimestamp: now, activityDates: paddedDates, pathElements, pathIndices },
    WASM, ZKEY
  );
  console.log(`Proof generated in ${((Date.now()-t0)/1000).toFixed(1)}s`);

  const vkey = JSON.parse(await readFile(VKEY_PATH, "utf-8"));
  const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  console.log(`Verified: ${valid}`);
  if (!valid) { console.error("FAILED"); process.exit(1); }

  const zkProof = {
    id: nanoid(12),
    circuit: "verified-builder",
    proof: {
      pi_a: proof.pi_a.map(String),
      pi_b: proof.pi_b.map(r => r.map(String)),
      pi_c: proof.pi_c.map(String),
      protocol: "groth16",
      curve: "bn128",
    },
    publicSignals: publicSignals.map(String),
    status: "verified",
    generatedAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
  };

  await writeFile(OUTPUT, JSON.stringify(zkProof, null, 2));
  console.log(`\nSaved to ${OUTPUT}`);
  console.log(`Proof ID: ${zkProof.id}`);
}

main().catch(e => { console.error(e); process.exit(1); });
