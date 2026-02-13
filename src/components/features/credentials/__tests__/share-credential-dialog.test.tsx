import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareCredentialDialog } from '../share-credential-dialog';
import type { UICredential } from '@/types/credentials';

// ---------------------------------------------------------------------------
// Mock qrcode.react to avoid canvas dependency in jsdom
// ---------------------------------------------------------------------------

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="qr-code" data-value={value} />
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCredential: UICredential = {
  id: 'cred-123',
  circuit: 'verified-builder',
  source: 'on-chain',
  status: 'on-chain',
  createdAt: '2024-01-15T10:00:00.000Z',
  verifiedAt: '2024-01-15T10:00:00.000Z',
  isExpired: false,
  publicSignals: ['100', '200'],
  claim: 'Active builder',
  owner: 'alice.near',
};

const mockCredentialNoClaim: UICredential = {
  ...mockCredential,
  id: 'cred-456',
  claim: undefined,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShareCredentialDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no credential is provided', () => {
    const { container } = render(
      <ShareCredentialDialog open={true} onOpenChange={onOpenChange} credential={null} />
    );
    // Dialog renders nothing
    expect(container.innerHTML).toBe('');
  });

  describe('URL building', () => {
    it('should include circuit, id, source, and claim in the share URL', () => {
      render(
        <ShareCredentialDialog
          open={true}
          onOpenChange={onOpenChange}
          credential={mockCredential}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      const url = input.value;

      expect(url).toContain('circuit=verified-builder');
      expect(url).toContain('id=cred-123');
      expect(url).toContain('source=on-chain');
      expect(url).toContain('claim=Active+builder');
      expect(url).toContain('/credentials/verify?');
    });

    it('should omit claim param when credential has no claim', () => {
      render(
        <ShareCredentialDialog
          open={true}
          onOpenChange={onOpenChange}
          credential={mockCredentialNoClaim}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).not.toContain('claim=');
    });
  });

  describe('clipboard', () => {
    it('should show copied state on successful copy', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });

      render(
        <ShareCredentialDialog
          open={true}
          onOpenChange={onOpenChange}
          credential={mockCredential}
        />
      );

      const copyButton = screen.getByRole('button', { name: '' });
      // The copy button is the one next to the input
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('circuit=verified-builder')
        );
      });
    });

    it('should not crash when clipboard.writeText rejects', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new DOMException('Not allowed')) },
      });

      render(
        <ShareCredentialDialog
          open={true}
          onOpenChange={onOpenChange}
          credential={mockCredential}
        />
      );

      const copyButton = screen.getByRole('button', { name: '' });

      // Should not throw
      expect(() => fireEvent.click(copyButton)).not.toThrow();

      // Wait a tick to ensure promise rejection was caught
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
    });
  });
});
