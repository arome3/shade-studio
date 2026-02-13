'use client';

import { Lock, HardDrive, Clock, Activity, BarChart3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import type { PrivacySettings as PrivacySettingsType } from '@/types/data-sovereignty';

// ============================================================================
// Types
// ============================================================================

interface PrivacySettingsProps {
  settings: PrivacySettingsType;
  onUpdate: <K extends keyof PrivacySettingsType>(
    key: K,
    value: PrivacySettingsType[K]
  ) => void;
}

// ============================================================================
// Setting Row
// ============================================================================

interface SettingRowProps {
  icon: typeof Lock;
  iconBg: string;
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ icon: Icon, iconBg, label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className={`p-2 rounded-lg ${iconBg} shrink-0`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function PrivacySettingsPanel({ settings, onUpdate }: PrivacySettingsProps) {
  return (
    <div className="space-y-1">
      {/* Encryption group */}
      <div className="pb-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1 px-1">
          Encryption
        </p>
        <SettingRow
          icon={Lock}
          iconBg="bg-near-green-500/10 text-near-green-500"
          label="Auto-encrypt new data"
          description="Automatically encrypt documents on upload"
        >
          <Switch
            checked={settings.autoEncrypt}
            onCheckedChange={(checked) => onUpdate('autoEncrypt', checked)}
          />
        </SettingRow>
      </div>

      <div className="h-px bg-border" />

      {/* Storage group */}
      <div className="py-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1 px-1">
          Storage
        </p>
        <SettingRow
          icon={HardDrive}
          iconBg="bg-info/10 text-info"
          label="Local metadata only"
          description="Keep metadata on-device instead of NEAR Social"
        >
          <Switch
            checked={settings.localMetadataOnly}
            onCheckedChange={(checked) => onUpdate('localMetadataOnly', checked)}
          />
        </SettingRow>
      </div>

      <div className="h-px bg-border" />

      {/* Sharing group */}
      <div className="py-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1 px-1">
          Sharing
        </p>
        <SettingRow
          icon={Clock}
          iconBg="bg-warning/10 text-warning"
          label="Auto-expire shares"
          description="Automatically expire shared links after a set time"
        >
          <Switch
            checked={settings.autoExpireShares}
            onCheckedChange={(checked) => onUpdate('autoExpireShares', checked)}
          />
        </SettingRow>

        {settings.autoExpireShares && (
          <div className="flex items-center gap-3 pl-12 pb-2">
            <span className="text-xs text-text-muted">Expire after</span>
            <Select
              value={String(settings.shareExpiryDays)}
              onValueChange={(v) => onUpdate('shareExpiryDays', Number(v))}
            >
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Tracking group */}
      <div className="pt-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1 px-1">
          Tracking
        </p>
        <SettingRow
          icon={Activity}
          iconBg="bg-near-purple-500/10 text-near-purple-500"
          label="Activity logging"
          description="Track data operations in the activity log"
        >
          <Switch
            checked={settings.activityLogEnabled}
            onCheckedChange={(checked) => onUpdate('activityLogEnabled', checked)}
          />
        </SettingRow>

        <SettingRow
          icon={BarChart3}
          iconBg="bg-surface text-text-muted"
          label="Analytics"
          description="Collect anonymous usage analytics"
        >
          <Switch
            checked={settings.analyticsEnabled}
            onCheckedChange={(checked) => onUpdate('analyticsEnabled', checked)}
          />
        </SettingRow>
      </div>
    </div>
  );
}
