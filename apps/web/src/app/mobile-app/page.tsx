import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const PWA_URL = process.env.NEXT_PUBLIC_MOBILE_PWA_URL ?? 'https://app.oasisportal.space';

export default async function MobileAppPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in/');

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '40px 24px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <p style={{ color: '#64748b', fontSize: 13, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Oasis Learning Centre
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', lineHeight: 1.2 }}>
          Get the mobile app
        </h1>
        <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 36px', fontSize: 15 }}>
          The Oasis app runs in your browser — no app store needed. Follow the steps for your
          device to add it to your home screen.
        </p>

        <DeviceSection
          badge="iPhone & iPad"
          color="#0ea5e9"
          steps={[
            'Open Safari on your iPhone or iPad.',
            `Go to ${PWA_URL}`,
            'Tap the Share button at the bottom of the screen (the box with an arrow pointing up).',
            'Scroll down and tap "Add to Home Screen".',
            'Tap "Add" in the top right to confirm.',
          ]}
          note='Must use Safari. Chrome and other browsers on iOS do not support "Add to Home Screen".'
        />

        <DeviceSection
          badge="Android"
          color="#22c55e"
          steps={[
            'Open Chrome on your Android phone or tablet.',
            `Go to ${PWA_URL}`,
            'Tap the three-dot menu in the top right corner.',
            'Tap "Add to Home Screen" or "Install app".',
            'Tap "Add" or "Install" to confirm.',
          ]}
        />

        <DeviceSection
          badge="Desktop (Chrome)"
          color="#8b5cf6"
          steps={[
            'Open Google Chrome on your computer.',
            `Go to ${PWA_URL}`,
            'Look for the install icon (⊕) on the right side of the address bar.',
            'Click it and then click "Install".',
            'The app will open as its own window.',
          ]}
          note="The install icon only appears in Chrome. It may take a moment to appear on your first visit."
        />
      </div>
    </main>
  );
}

function DeviceSection({
  badge,
  color,
  steps,
  note,
}: {
  badge: string;
  color: string;
  steps: string[];
  note?: string;
}) {
  return (
    <section
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          backgroundColor: color,
          padding: '10px 20px',
        }}
      >
        <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
          {badge}
        </span>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {steps.map((step, i) => (
            <li key={i} style={{ color: '#334155', fontSize: 14, lineHeight: 1.6 }}>
              {step}
            </li>
          ))}
        </ol>
        {note ? (
          <p
            style={{
              margin: '16px 0 0',
              padding: '10px 14px',
              backgroundColor: '#f1f5f9',
              borderRadius: 8,
              color: '#64748b',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {note}
          </p>
        ) : null}
      </div>
    </section>
  );
}
