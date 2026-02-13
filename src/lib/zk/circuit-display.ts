/**
 * Circuit Display Configuration
 *
 * Single source of truth for circuit-specific UI metadata: icons, colors,
 * labels, and descriptions. All components should import from here instead
 * of defining local constants.
 *
 * Tailwind classes are written as full static strings so they survive
 * Tailwind's content scanner (no dynamic concatenation).
 */

import { Shield, Award, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ZKCircuit } from '@/types/zk';
import type { CircuitDisplayInfo } from '@/types/credentials';

// ============================================================================
// Types
// ============================================================================

export interface CircuitDisplayConfig extends CircuitDisplayInfo {
  icon: LucideIcon;
  /** Card left-border accent */
  borderClass: string;
  /** Selected/hover border for selector */
  borderActiveClass: string;
  /** Hover border transition */
  hoverBorderClass: string;
  /** Icon background */
  iconBgClass: string;
  /** Icon text color */
  iconTextClass: string;
  /** Pulsing ring for progress animations */
  ringClass: string;
  /** Progress bar fill color */
  progressClass: string;
  /** Selection indicator dot background */
  dotColorClass: string;
}

// ============================================================================
// Config
// ============================================================================

export const CIRCUIT_DISPLAY: Record<ZKCircuit, CircuitDisplayConfig> = {
  'verified-builder': {
    id: 'verified-builder',
    name: 'Verified Builder',
    description: 'Proves activity history without revealing specific actions',
    requirement: 'Minimum active days on-chain',
    accentColor: 'near-green-500',
    gradientFrom: 'from-near-green-500/20',
    gradientTo: 'to-near-green-500/5',
    icon: Shield,
    borderClass: 'border-l-near-green-500',
    borderActiveClass: 'border-near-green-500/30',
    hoverBorderClass: 'hover:border-near-green-500/60',
    iconBgClass: 'bg-near-green-500/10',
    iconTextClass: 'text-near-green-500',
    ringClass: 'border-near-green-500/30',
    progressClass: 'bg-near-green-500',
    dotColorClass: 'bg-near-green-500',
  },
  'grant-track-record': {
    id: 'grant-track-record',
    name: 'Grant Track Record',
    description: 'Proves grant history without revealing amounts or details',
    requirement: 'Minimum completed grants',
    accentColor: 'near-cyan-500',
    gradientFrom: 'from-near-cyan-500/20',
    gradientTo: 'to-near-cyan-500/5',
    icon: Award,
    borderClass: 'border-l-near-cyan-500',
    borderActiveClass: 'border-near-cyan-500/30',
    hoverBorderClass: 'hover:border-near-cyan-500/60',
    iconBgClass: 'bg-near-cyan-500/10',
    iconTextClass: 'text-near-cyan-500',
    ringClass: 'border-near-cyan-500/30',
    progressClass: 'bg-near-cyan-500',
    dotColorClass: 'bg-near-cyan-500',
  },
  'team-attestation': {
    id: 'team-attestation',
    name: 'Team Attestation',
    description: 'Proves team endorsements without revealing attesters',
    requirement: 'Minimum team attestations',
    accentColor: 'near-purple-500',
    gradientFrom: 'from-near-purple-500/20',
    gradientTo: 'to-near-purple-500/5',
    icon: Users,
    borderClass: 'border-l-near-purple-500',
    borderActiveClass: 'border-near-purple-500/30',
    hoverBorderClass: 'hover:border-near-purple-500/60',
    iconBgClass: 'bg-near-purple-500/10',
    iconTextClass: 'text-near-purple-500',
    ringClass: 'border-near-purple-500/30',
    progressClass: 'bg-near-purple-500',
    dotColorClass: 'bg-near-purple-500',
  },
};

// ============================================================================
// Helpers
// ============================================================================

/** Get the full display config for a circuit. */
export function getCircuitDisplay(circuit: ZKCircuit): CircuitDisplayConfig {
  return CIRCUIT_DISPLAY[circuit];
}

/** Get just the human-readable label for a circuit. */
export function getCircuitLabel(circuit: ZKCircuit): string {
  return CIRCUIT_DISPLAY[circuit].name;
}

/** Get the Lucide icon component for a circuit. */
export function getCircuitIcon(circuit: ZKCircuit): LucideIcon {
  return CIRCUIT_DISPLAY[circuit].icon;
}
