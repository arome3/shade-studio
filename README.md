<div align="center">

# 🛡️ Shade Studio

**Privacy-first AI workspace for Web3 builders on NEAR Protocol**

### [Watch the Demo (3 min)](https://youtu.be/7SnOKEmkP3k)

[![Watch the Demo](https://img.shields.io/badge/%E2%96%B6%EF%B8%8F_WATCH_DEMO-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/7SnOKEmkP3k)

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)
[![NEAR](https://img.shields.io/badge/NEAR-Protocol-00C08B.svg?logo=near)](https://near.org)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-339933.svg?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000.svg?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev)

Write grants, run AI analysis, and prove credentials — all encrypted, all yours, all on-chain.

**Only on NEAR:** Sub-Accounts · Chain Signatures · Yield/Resume · Codehash Attestation · Global State

</div>

---

## Table of Contents

- [Why Shade Studio?](#why-shade-studio)
- [Features](#features)
- [Architecture](#architecture)
- [Only on NEAR](#only-on-near)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Smart Contracts](#smart-contracts)
- [ZK Circuits](#zk-circuits)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Testing](#testing)
- [Feature Flags](#feature-flags)
- [Scripts Reference](#scripts-reference)
- [Supported Wallets & Chains](#supported-wallets--chains)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Why Shade Studio?

### True Privacy

Your grant proposals, financials, and strategy documents are encrypted **before** they leave your browser. Keys are derived from your NEAR wallet — no server ever sees plaintext. Export or delete everything with one click via the Data Sovereignty Dashboard.

### Privacy-Respecting AI

AI analysis runs inside Trusted Execution Environments (TEEs) via NEAR AI Cloud. Every response includes a cryptographic attestation proving your data was processed in isolation. The AI never trains on your inputs and cannot persist anything beyond your session.

### ZK Credentials

Prove you've completed 5+ grants, managed a team of 3+, or verified your builder history — all without revealing which grants, which people, or which projects. Groth16 proofs generated client-side with snarkjs, verified on-chain via a NEAR Rust contract.

---

## Features

<details>
<summary><strong>AI & Intelligence</strong> (4 features)</summary>

| Feature | Description |
|---------|-------------|
| **Grant Writing Assistant** | AI-powered proposal drafting with PotLock template support and section-by-section feedback |
| **Daily Briefing** | Personalized intelligence feed analyzing your ecosystem, competitors, and upcoming deadlines |
| **Competitive Tracker** | Log and analyze competitive intelligence entries with AI-generated insights and trend detection |
| **Weekly Synthesis** | Automated weekly report combining briefings, decisions, meetings, and competitive intel into actionable summaries |

</details>

<details>
<summary><strong>Privacy & Security</strong> (3 features)</summary>

| Feature | Description |
|---------|-------------|
| **ZK Credentials** | Generate zero-knowledge proofs for grant track records, team size, and builder history without revealing underlying data |
| **Data Sovereignty** | Full export, selective deletion, and access audit logs — you own every byte of your data |
| **E2E Encryption** | TweetNaCl-based client-side encryption with wallet-derived keys; documents encrypted before upload to IPFS |

</details>

<details>
<summary><strong>Workflow & Productivity</strong> (3 features)</summary>

| Feature | Description |
|---------|-------------|
| **Proposal Editor** | Structured grant proposal editor with markdown support, version history, and AI-assisted section generation |
| **Decision Journal** | Capture strategic decisions with context, alternatives considered, and expected outcomes for future reference |
| **Meeting Notes Pipeline** | Extract action items, decisions, and follow-ups from meeting notes with AI-powered analysis |

</details>

<details>
<summary><strong>NEAR-Native</strong> (5 features)</summary>

| Feature | Description |
|---------|-------------|
| **Project Sub-Accounts** | NEAR-native hierarchical workspaces with per-key permissions — no smart contracts needed for team access control |
| **Async AI Pipeline** | Long-running AI jobs via NEAR's yield/resume pattern — checkpoint state across transactions with no timeout limits |
| **Shade Agents** | User-owned AI agents with on-chain codehash verification and capability-bounded function-call access keys |
| **Cross-Chain Submission** | Submit grant proposals to Ethereum, Optimism, Arbitrum, and more using NEAR Chain Signatures — one wallet, all chains |
| **Grant Registry** | Ecosystem-wide composable registry of grant programs, applications, and outcomes as a NEAR public good |

</details>

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT                                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                        Next.js 15 Application                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │   React 19  │  │   Zustand   │  │  TweetNaCl  │  │ @near-js/*      │  │  │
│  │  │   UI Layer  │  │   State     │  │  Crypto     │  │ Blockchain SDK  │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │  │
│  │         └────────────────┴────────────────┴───────────────────┘           │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                │                    │                         │
                ▼                    ▼                         ▼
┌───────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────────┐
│    IPFS / Pinata      │  │   NEAR Protocol     │  │      NEAR AI Cloud          │
│   (Encrypted Docs)    │  │  (social.near)      │  │   (TEE Inference)           │
└───────────────────────┘  └─────────────────────┘  └─────────────────────────────┘
```

### NEAR-Native Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         NEAR-NATIVE ARCHITECTURE                                     │
│                         Shade Studio                                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                              User: alice.near                                │    │
│  │                                                                              │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │    │
│  │  │ project-1.       │  │ project-2.       │  │ grant-agent.     │          │    │
│  │  │ alice.near       │  │ alice.near       │  │ alice.near       │          │    │
│  │  │                  │  │                  │  │                  │          │    │
│  │  │ SUB-ACCOUNT      │  │ SUB-ACCOUNT      │  │ SHADE AGENT      │          │    │
│  │  │                  │  │                  │  │                  │          │    │
│  │  │ • Team keys      │  │ • Team keys      │  │ • Codehash       │          │    │
│  │  │ • Permissions    │  │ • Permissions    │  │ • TEE attestation│          │    │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │    │
│  │           │                     │                     │                     │    │
│  └───────────┼─────────────────────┼─────────────────────┼─────────────────────┘    │
│              │                     │                     │                          │
│              └──────────────┬──────┴──────────────┬──────┘                          │
│                             │                     │                                  │
│                             ▼                     ▼                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                              │    │
│  │   ┌────────────────┐    ┌────────────────┐    ┌────────────────┐            │    │
│  │   │ MPC SIGNER     │    │ ASYNC AI       │    │ GRANT          │            │    │
│  │   │ v1.signer.near │    │ PROCESSOR      │    │ REGISTRY       │            │    │
│  │   │                │    │                │    │                │            │    │
│  │   │ Chain Sigs     │    │ Yield/Resume   │    │ Global State   │            │    │
│  │   │                │    │                │    │                │            │    │
│  │   │ Signs for:     │    │ • Checkpoints  │    │ • Programs     │            │    │
│  │   │ • Ethereum     │    │ • Multi-minute │    │ • Projects     │            │    │
│  │   │ • Optimism     │    │   AI jobs      │    │ • Applications │            │    │
│  │   │ • Arbitrum     │    │ • Resume state │    │ • Composable   │            │    │
│  │   │ • Any EVM      │    │                │    │                │            │    │
│  │   └────────────────┘    └────────────────┘    └────────────────┘            │    │
│  │                                                                              │    │
│  │                         NEAR PROTOCOL LAYER                                  │    │
│  │                                                                              │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Only on NEAR

These features leverage NEAR's unique blockchain primitives — functionality that is **impossible on other chains**.

| Feature | NEAR Primitive | Why Impossible Elsewhere |
|---------|----------------|--------------------------|
| **Project Sub-Accounts** | Account Model | Native hierarchical identity with per-key permissions — no smart contracts needed |
| **Chain Signatures** | MPC Network | One wallet signs for any chain via threshold cryptography — no bridges or wrapping |
| **Async AI Pipelines** | Yield/Resume | Multi-minute jobs with state checkpointing across transactions — no timeout limits |
| **Shade Agents** | Codehash Attestation | Verifiable user-owned AI via on-chain code verification and function-call keys |
| **Grant Registry** | Global State | Ecosystem-wide composable data as a public good — free view calls, no indexers |

### Competitive Analysis

| Capability | NEAR | Ethereum | Solana | Cosmos |
|------------|:----:|:--------:|:------:|:------:|
| Native sub-accounts | ✅ | ❌ | ❌ | ❌ |
| Function-call access keys | ✅ | ❌ | ❌ | ❌ |
| MPC chain signatures | ✅ | ❌ | ❌ | ❌ |
| Yield/resume compute | ✅ | ❌ | ❌ | ❌ |
| Composable global state | ✅ | ❌ | ❌ | ❌ |
| TEE-native AI | ✅ | ❌ | ❌ | ❌ |

---

## Quick Start

### Prerequisites

- **Node.js** >= 20.0.0
- A [NEAR testnet wallet](https://testnet.mynearwallet.com/)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/arome3/shade-studio.git
cd shade-studio

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local

# 4. Start development server
npm run dev

# 5. Open in browser
open http://localhost:3000
```

### Optional: Build ZK Circuits

```bash
# Compile circuits, run trusted setup, and export verifier
npm run circuits:build
```

---

## Environment Configuration

The three most critical variables to set:

```bash
NEXT_PUBLIC_NEAR_NETWORK=testnet          # mainnet or testnet
AI_API_KEY=your_api_key                   # NEAR AI Cloud API key
NEXT_PUBLIC_NEAR_CONTRACT_ID=private-grant-studio.testnet
```

<details>
<summary><strong>Full Environment Variable Reference</strong></summary>

| Variable | Description | Default | Required |
|----------|-------------|---------|:--------:|
| `NEXT_PUBLIC_NEAR_NETWORK` | NEAR network to connect to | `testnet` | ✅ |
| `NEXT_PUBLIC_NEAR_CONTRACT_ID` | Main contract account | `private-grant-studio.testnet` | ✅ |
| `NEXT_PUBLIC_SOCIAL_CONTRACT_ID` | NEAR Social contract | `v1.social08.testnet` | ✅ |
| `NEXT_PUBLIC_AI_ENDPOINT` | AI inference endpoint | `https://api.near.ai` | ✅ |
| `AI_API_KEY` | NEAR AI Cloud API key | — | ✅ |
| `PINATA_API_KEY` | IPFS pinning API key (Pinata) | — | ⬜ |
| `PINATA_SECRET_KEY` | IPFS pinning secret (Pinata) | — | ⬜ |
| `NEXT_PUBLIC_IPFS_GATEWAY` | IPFS gateway URL | `https://gateway.pinata.cloud/ipfs` | ⬜ |
| `NEXT_PUBLIC_ENCRYPTION_VERSION` | Encryption schema version | `1` | ⬜ |
| `NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ID` | ZK verifier contract | `zk-verifier.private-grant-studio.testnet` | ⬜ |
| `NEXT_PUBLIC_ASYNC_AI_CONTRACT_ID` | Async AI processor contract | `async-ai.private-grant-studio.testnet` | ⬜ |
| `NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT_ID` | Shade Agent registry contract | `agent-registry.private-grant-studio.testnet` | ⬜ |
| `NEXT_PUBLIC_GRANT_REGISTRY_CONTRACT_ID` | Grant registry contract | `grant-registry.private-grant-studio.testnet` | ⬜ |
| `NEXT_PUBLIC_ENABLE_ZK_PROOFS` | Enable ZK credential features | `true` | ⬜ |
| `NEXT_PUBLIC_ENABLE_AI_FEATURES` | Enable AI assistant features | `true` | ⬜ |
| `NEXT_PUBLIC_ENABLE_DAILY_BRIEFINGS` | Enable daily intelligence briefings | `true` | ⬜ |
| `NEXT_PUBLIC_ENABLE_CHAIN_SIGNATURES` | Enable cross-chain submission | `false` | ⬜ |
| `NEXT_PUBLIC_ENABLE_ASYNC_AI` | Enable async AI pipeline | `true` | ⬜ |
| `NEXT_PUBLIC_ENABLE_SHADE_AGENTS` | Enable Shade Agents | `true` | ⬜ |
| `NEXT_PUBLIC_ENABLE_GRANT_REGISTRY` | Enable grant registry | `true` | ⬜ |
| `NEXT_PUBLIC_DEBUG_MODE` | Enable debug logging | `false` | ⬜ |

</details>

---

## Smart Contracts

Four NEAR smart contracts written in Rust:

| Contract | Directory | Testnet Account | Description |
|----------|-----------|-----------------|-------------|
| **ZK Verifier** | `contracts/zk-verifier/` | `zk-verifier.private-grant-studio.testnet` | On-chain Groth16 proof verification for ZK credentials |
| **Async AI Processor** | `contracts/async-ai-processor/` | `async-ai.private-grant-studio.testnet` | Job queue with yield/resume for long-running AI tasks |
| **Shade Agent Registry** | `contracts/shade-agent-registry/` | `agent-registry.private-grant-studio.testnet` | Agent registration with codehash verification and capabilities |
| **Grant Registry** | `contracts/grant-registry/` | `grant-registry.private-grant-studio.testnet` | Ecosystem-wide grant program and application tracking |

```bash
# Build a contract
cd contracts/zk-verifier
./build.sh

# Deploy all contracts to testnet
./scripts/deploy-contracts.sh testnet private-grant-studio.testnet

# Upgrade a single contract
./scripts/upgrade-contract.sh testnet zk-verifier zk-verifier.private-grant-studio.testnet
```

---

## ZK Circuits

Three Circom circuits for privacy-preserving credential proofs:

| Circuit | File | Purpose |
|---------|------|---------|
| **Verified Builder** | `src/circuits/verified-builder.circom` | Prove builder history without revealing specific projects |
| **Grant Track Record** | `src/circuits/grant-track-record.circom` | Prove grant completion count without revealing which grants |
| **Team Attestation** | `src/circuits/team-attestation.circom` | Prove team size threshold without revealing team members |

```bash
# Full circuit build pipeline
npm run circuits:build

# Or run individual steps:
npm run circuits:compile     # Compile .circom → .wasm + .r1cs
npm run circuits:setup       # Powers-of-tau trusted setup
npm run circuits:export      # Export Solidity/NEAR verifier
npm run circuits:hashes      # Generate artifact integrity hashes
```

---

## Project Structure

```
shade-studio/
├── contracts/                    # 4 NEAR smart contracts (Rust)
│   ├── async-ai-processor/       #   Yield/resume AI job queue
│   ├── grant-registry/           #   Ecosystem grant tracking
│   ├── shade-agent-registry/     #   Agent codehash verification
│   └── zk-verifier/              #   Groth16 proof verification
├── scripts/                      # Build & deploy scripts
│   ├── compile-circuits.sh       #   Circom compilation
│   ├── trusted-setup.sh          #   ZK trusted setup ceremony
│   ├── export-verifier.sh        #   Verifier contract export
│   ├── generate-artifact-hashes.sh
│   └── async-ai-worker.ts        #   AI worker daemon
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               #   Protected routes (projects, intelligence, credentials)
│   │   └── api/                  #   API routes (ai, ipfs, zk)
│   ├── circuits/                 # 3 Circom ZK circuits
│   ├── components/               # 126 React components
│   │   ├── ui/                   #   Radix UI primitives (Button, Dialog, Tabs, etc.)
│   │   ├── features/             #   Feature-specific components
│   │   ├── layout/               #   App layout (Sidebar, Header, etc.)
│   │   ├── providers/            #   Context providers (Wallet, Theme, Toast)
│   │   └── data-sovereignty/     #   Export, deletion, audit UI
│   ├── hooks/                    # 27 custom React hooks
│   ├── lib/                      # Core libraries
│   │   ├── agents/               #   Shade Agent management
│   │   ├── ai/                   #   NEAR AI Cloud client
│   │   ├── attestation/          #   TEE attestation verification
│   │   ├── chain-signatures/     #   Cross-chain signing
│   │   ├── crypto/               #   TweetNaCl encryption
│   │   ├── documents/            #   Document vault logic
│   │   ├── grants/               #   Grant registry helpers
│   │   ├── intelligence/         #   Briefing & competitive analysis
│   │   ├── near/                 #   NEAR SDK integration
│   │   ├── proposals/            #   Proposal editor logic
│   │   ├── storage/              #   IPFS & local storage
│   │   ├── utils/                #   Shared utilities
│   │   ├── zk/                   #   snarkjs proof generation
│   │   ├── config.ts             #   Zod-validated env config
│   │   └── constants.ts          #   App-wide constants
│   ├── stores/                   # 32 Zustand state stores
│   └── types/                    # 17 TypeScript type definitions
├── public/                       # Static assets & compiled circuit artifacts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── next.config.ts
```

---

## Tech Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Framework** | Next.js | 15.x | App Router, SSR, API routes |
| **UI Library** | React | 19.x | Component architecture |
| **Language** | TypeScript | 5.4+ | Type safety across the stack |
| **State** | Zustand | 5.x | Minimal, TypeScript-first state management |
| **Styling** | Tailwind CSS | 4.x | Utility-first styling |
| **Components** | Radix UI | Latest | Accessible, unstyled UI primitives |
| **Animation** | Framer Motion | 11.x | Declarative animations |
| **Blockchain** | @near-js/* | Latest | NEAR Protocol SDK |
| **Wallet** | NEAR Wallet Selector | 8.x | Multi-wallet support |
| **Social** | @builddao/near-social-js | 1.x | NEAR Social / BOS integration |
| **Encryption** | TweetNaCl.js | 1.x | Client-side E2E encryption (7KB, audited) |
| **ZK Proofs** | snarkjs + Circom | 0.7.x | Groth16 proof generation & verification |
| **Cross-Chain** | ethers.js | 6.x | EVM transaction construction |
| **AI** | NEAR AI Cloud | — | TEE-isolated inference (Llama 3.3 70B) |
| **Storage** | Pinata (IPFS) | — | Encrypted document persistence |
| **Validation** | Zod | 3.x | Runtime schema validation |
| **Testing** | Vitest | 2.x | Unit & integration tests with jsdom |
| **Smart Contracts** | Rust (near-sdk) | — | On-chain logic for ZK, agents, registry |

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Type checking
npm run typecheck

# ZK circuit end-to-end test
npm run test:e2e
```

**Setup:** Vitest with jsdom environment, React Testing Library, and fake-indexeddb for storage tests. **91 test files** across components, hooks, stores, and libraries.

---

## Feature Flags

Toggle features via environment variables or `src/lib/config.ts`:

| Flag | Default | Description |
|------|---------|-------------|
| `NEXT_PUBLIC_ENABLE_ZK_PROOFS` | `true` | ZK credential generation and verification |
| `NEXT_PUBLIC_ENABLE_AI_FEATURES` | `true` | AI grant writing assistant and analysis |
| `NEXT_PUBLIC_ENABLE_DAILY_BRIEFINGS` | `true` | Daily intelligence briefing feed |
| `NEXT_PUBLIC_ENABLE_CHAIN_SIGNATURES` | `false` | Cross-chain grant submission via MPC |
| `NEXT_PUBLIC_ENABLE_ASYNC_AI` | `true` | Async AI pipeline with yield/resume |
| `NEXT_PUBLIC_ENABLE_SHADE_AGENTS` | `true` | User-owned AI agents |
| `NEXT_PUBLIC_ENABLE_GRANT_REGISTRY` | `true` | Global grant program registry |
| `NEXT_PUBLIC_DEBUG_MODE` | `false` | Verbose console logging |

---

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Next.js development server |
| `build` | `npm run build` | Production build |
| `start` | `npm run start` | Start production server |
| `lint` | `npm run lint` | ESLint check |
| `test` | `npm test` | Run Vitest test suite |
| `test:watch` | `npm run test:watch` | Vitest in watch mode |
| `test:coverage` | `npm run test:coverage` | Coverage report |
| `typecheck` | `npm run typecheck` | TypeScript type checking |
| `test:e2e` | `npm run test:e2e` | ZK circuit end-to-end test |
| `circuits:build` | `npm run circuits:build` | Full ZK circuit build pipeline |

---

## Supported Wallets & Chains

### Wallets

| Wallet | Type | Support |
|--------|------|---------|
| [My NEAR Wallet](https://mynearwallet.com/) | Browser | ✅ Full |
| [HERE Wallet](https://herewallet.app/) | Mobile | ✅ Full |

### EVM Chains (via Chain Signatures)

| Chain | Chain ID | Token | Status |
|-------|----------|-------|--------|
| Ethereum | 1 | ETH | ✅ Supported |
| Optimism | 10 | ETH | ✅ Supported |
| Arbitrum | 42161 | ETH | ✅ Supported |
| Polygon | 137 | MATIC | ✅ Supported |
| Base | 8453 | ETH | ✅ Supported |

### AI Models

| Model | Provider | Use Case |
|-------|----------|----------|
| Llama 3.3 70B Instruct | NEAR AI Cloud (TEE) | Grant writing, analysis, briefings |

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Commit** your changes: `git commit -m "feat: add your feature"`
4. **Push** to the branch: `git push origin feature/your-feature`
5. **Open** a Pull Request

### Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `wallet-provider.tsx` |
| Components | PascalCase | `WalletConnectButton` |
| Functions | camelCase | `initializeEncryption` |
| Constants | SCREAMING_SNAKE_CASE | `NEAR_AI_API_URL` |
| Types/Interfaces | PascalCase | `EncryptionKeyPair` |
| Hooks | `use` prefix | `useEncryption` |
| Stores | `Store` suffix | `useAuthStore` |

Explore the `src/` directory — each feature module is self-contained with its own components, hooks, stores, and tests.

---

## License

This project is licensed under the MIT License.

---

## Acknowledgments

- [NEAR Protocol](https://near.org) — Account model, chain signatures, yield/resume
- [NEAR AI Cloud](https://docs.near.ai) — TEE-isolated AI inference
- [PotLock](https://potlock.org) — Grant proposal templates and NEAR Social patterns
- [snarkjs](https://github.com/iden3/snarkjs) — Groth16 proof generation
- [Radix UI](https://www.radix-ui.com) — Accessible component primitives
- [Pinata](https://pinata.cloud) — IPFS pinning and gateway

---

<div align="center">

**Built with privacy in mind. Built on NEAR.**

*Shade Studio — Only Possible on NEAR.*

</div>
