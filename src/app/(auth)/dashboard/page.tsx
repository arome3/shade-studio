'use client';

import Link from 'next/link';
import {
  FileText,
  Sparkles,
  BookOpen,
  Shield,
  Bot,
  Lock,
} from 'lucide-react';
import { useAccountId } from '@/stores/auth-store';

const features = [
  {
    title: 'Document Vault',
    description: 'Encrypted files on IPFS',
    href: '/documents',
    icon: FileText,
  },
  {
    title: 'AI Studio',
    description: 'Private AI with TEE attestation',
    href: '/ai',
    icon: Sparkles,
  },
  {
    title: 'Grant Registry',
    description: 'On-chain grant programs',
    href: '/grants',
    icon: BookOpen,
  },
  {
    title: 'ZK Credentials',
    description: 'Zero-knowledge proofs',
    href: '/credentials/verify',
    icon: Shield,
  },
  {
    title: 'Shade Agents',
    description: 'Verifiable AI agents',
    href: '/agents',
    icon: Bot,
  },
  {
    title: 'Data Sovereignty',
    description: 'Control your data',
    href: '/data-sovereignty',
    icon: Lock,
  },
] as const;

export default function DashboardPage() {
  const accountId = useAccountId();

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">
          Welcome to Shade Studio
        </h1>
        {accountId && (
          <p className="mt-2 text-text-muted">
            Connected as <span className="font-mono text-text-secondary">{accountId}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group rounded-lg border border-border bg-surface p-6 transition-colors hover:border-primary hover:bg-surface-hover"
          >
            <feature.icon className="h-8 w-8 text-primary mb-3" />
            <h2 className="text-lg font-semibold text-text-primary group-hover:text-primary">
              {feature.title}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {feature.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
