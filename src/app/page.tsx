import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* NEAR Logo/Badge */}
        <div className="mb-8 flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-full">
          <div className="w-2 h-2 rounded-full bg-near-green-500 animate-pulse" />
          <span className="text-sm text-text-secondary">
            Built on NEAR Protocol
          </span>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl md:text-6xl font-bold text-center mb-6">
          <span className="text-text-primary">Private</span>{' '}
          <span className="text-gradient">Grant Studio</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-text-secondary text-center max-w-2xl mb-8">
          Privacy-first AI workspace for Web3 builders.
          <br />
          <span className="text-text-muted">
            Secure proposals. Zero-knowledge proofs. NEAR native.
          </span>
        </p>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {[
            { icon: '🔐', label: 'End-to-End Encryption' },
            { icon: '🤖', label: 'AI-Powered Writing' },
            { icon: '🛡️', label: 'TEE Attestations' },
            { icon: '📜', label: 'ZK Credentials' },
          ].map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-2 px-4 py-2 bg-surface/50 border border-border rounded-lg text-sm"
            >
              <span>{feature.icon}</span>
              <span className="text-text-secondary">{feature.label}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-near-green-500 text-near-black font-semibold rounded-lg hover:bg-near-green-400 transition-colors glow text-center"
          >
            Launch Studio
          </Link>
          <Link
            href="/docs"
            className="px-8 py-3 bg-surface border border-border text-text-primary font-semibold rounded-lg hover:bg-surface-hover hover:border-border-hover transition-colors text-center"
          >
            Documentation
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <section className="px-4 py-16 bg-background-secondary">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            <span className="text-text-primary">Why</span>{' '}
            <span className="text-gradient">Private Grant Studio?</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature Card 1 */}
            <div className="p-6 bg-surface border border-border rounded-xl hover:border-border-hover transition-colors">
              <div className="w-12 h-12 mb-4 rounded-lg bg-near-green-500/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-near-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                True Privacy
              </h3>
              <p className="text-text-secondary text-sm">
                Your proposals are encrypted client-side before leaving your
                device. Only you and your team can read them.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="p-6 bg-surface border border-border rounded-xl hover:border-border-hover transition-colors">
              <div className="w-12 h-12 mb-4 rounded-lg bg-near-green-500/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-near-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                AI That Respects Privacy
              </h3>
              <p className="text-text-secondary text-sm">
                AI assistance runs in Phala TEE environments. Your data is
                processed but never stored or exposed.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="p-6 bg-surface border border-border rounded-xl hover:border-border-hover transition-colors">
              <div className="w-12 h-12 mb-4 rounded-lg bg-near-green-500/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-near-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                ZK Credentials
              </h3>
              <p className="text-text-secondary text-sm">
                Prove grant eligibility and milestone completion without
                revealing sensitive details using zero-knowledge proofs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-near-green-500" />
            <span className="text-sm text-text-secondary">
              Private Grant Studio
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              Docs
            </Link>
            <Link
              href="https://github.com"
              className="text-sm text-text-muted hover:text-text-secondary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>
            <Link
              href="https://near.org"
              className="text-sm text-text-muted hover:text-text-secondary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              NEAR
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
