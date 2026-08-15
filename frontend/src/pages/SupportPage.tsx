import { useState } from 'react';
import PageLayout from '../components/PageLayout';

export default function SupportPage() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-2">SUPPORT</h1>
          <p className="text-slate-400 text-sm">Need help running or competing in a ZECATHON? Reach out below.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="glass-panel p-6">
            <h2 className="font-pixel text-xs text-neon-cyan mb-3">EMAIL US</h2>
            <a
              href="mailto:support@zetheta.com"
              className="text-sm text-slate-300 hover:text-neon-cyan transition break-all"
            >
              support@zetheta.com
            </a>
            <p className="text-xs text-slate-500 mt-2">Typical response time: 1-2 business days.</p>
          </div>

          <div className="glass-panel p-6">
            <h2 className="font-pixel text-xs text-neon-cyan mb-3">COMMON QUESTIONS</h2>
            <ul className="text-sm text-slate-400 space-y-2">
              <li>• How do I create a hackathon? Use the Host button after logging in as an Organizer.</li>
              <li>• What file types can non-tech teams upload? PDF, DOCX, PPTX, and XLSX.</li>
              <li>• Why are scores discrete? Tie-breaking keeps every rank earned and fair.</li>
            </ul>
          </div>
        </div>

        <div className="glass-panel p-6">
          <h2 className="font-pixel text-xs text-neon-cyan mb-4">SEND A MESSAGE</h2>
          {sent ? (
            <div className="px-4 py-3 rounded bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm">
              Message received. We will get back to you soon.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Your email</label>
                <input type="email" required className="w-full rounded px-4 py-3 neon-input" placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Message</label>
                <textarea required rows={4} className="w-full rounded px-4 py-3 neon-input" placeholder="How can we help?" />
              </div>
              <button type="submit" className="w-full rounded neon-btn neon-btn-primary micro-lift micro-pop py-3 text-sm">
                Send message
              </button>
            </form>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
