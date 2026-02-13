import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PrivacySettings } from '@/types/data-sovereignty';

import { PrivacySettingsPanel } from '../privacy-settings';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const defaultSettings: PrivacySettings = {
  autoEncrypt: true,
  localMetadataOnly: false,
  autoExpireShares: true,
  shareExpiryDays: 7,
  activityLogEnabled: true,
  analyticsEnabled: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PrivacySettingsPanel', () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 5 settings', () => {
    render(<PrivacySettingsPanel settings={defaultSettings} onUpdate={onUpdate} />);

    expect(screen.getByText('Auto-encrypt new data')).toBeDefined();
    expect(screen.getByText('Local metadata only')).toBeDefined();
    expect(screen.getByText('Auto-expire shares')).toBeDefined();
    expect(screen.getByText('Activity logging')).toBeDefined();
    expect(screen.getByText('Analytics')).toBeDefined();
  });

  it('renders section headers', () => {
    render(<PrivacySettingsPanel settings={defaultSettings} onUpdate={onUpdate} />);

    expect(screen.getByText('Encryption')).toBeDefined();
    expect(screen.getByText('Storage')).toBeDefined();
    expect(screen.getByText('Sharing')).toBeDefined();
    expect(screen.getByText('Tracking')).toBeDefined();
  });

  it('toggle autoEncrypt calls onUpdate with correct key/value', () => {
    render(<PrivacySettingsPanel settings={defaultSettings} onUpdate={onUpdate} />);

    // autoEncrypt is true → clicking should toggle to false
    // Find the switch associated with "Auto-encrypt new data"
    const switches = screen.getAllByRole('switch');
    // First switch is autoEncrypt
    fireEvent.click(switches[0]!);

    expect(onUpdate).toHaveBeenCalledWith('autoEncrypt', false);
  });

  it('toggle activityLogEnabled calls onUpdate', () => {
    render(<PrivacySettingsPanel settings={defaultSettings} onUpdate={onUpdate} />);

    const switches = screen.getAllByRole('switch');
    // Order: autoEncrypt, localMetadataOnly, autoExpireShares, activityLogEnabled, analyticsEnabled
    fireEvent.click(switches[3]!);

    expect(onUpdate).toHaveBeenCalledWith('activityLogEnabled', false);
  });

  it('expiry days select is visible when autoExpireShares is true', () => {
    render(<PrivacySettingsPanel settings={defaultSettings} onUpdate={onUpdate} />);

    expect(screen.getByText('Expire after')).toBeDefined();
  });

  it('expiry days select is hidden when autoExpireShares is false', () => {
    render(
      <PrivacySettingsPanel
        settings={{ ...defaultSettings, autoExpireShares: false }}
        onUpdate={onUpdate}
      />
    );

    expect(screen.queryByText('Expire after')).toBeNull();
  });

  it('settings show correct checked state when all disabled', () => {
    const allDisabled: PrivacySettings = {
      autoEncrypt: false,
      localMetadataOnly: false,
      autoExpireShares: false,
      shareExpiryDays: 7,
      activityLogEnabled: false,
      analyticsEnabled: false,
    };

    render(<PrivacySettingsPanel settings={allDisabled} onUpdate={onUpdate} />);

    const switches = screen.getAllByRole('switch');
    // All should be unchecked (aria-checked="false")
    for (const sw of switches) {
      expect(sw.getAttribute('aria-checked')).toBe('false');
    }
  });
});
