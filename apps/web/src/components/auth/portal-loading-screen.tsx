'use client';

import Image from 'next/image';

interface PortalLoadingScreenProps {
  message: string;
  supportingText?: string;
}

export function PortalLoadingScreen({
  message,
  supportingText = 'Oasis Learning Centre',
}: PortalLoadingScreenProps) {
  return (
    <main aria-live="polite" className="portal-loading-screen">
      <div className="portal-loading-screen__panel" role="status">
        <span className="portal-loading-screen__logo">
          <Image
            alt="Oasis Learning Centre"
            height={88}
            priority
            src="/oasis-logo.svg"
            width={220}
          />
        </span>
        <p>{message}</p>
        <span>{supportingText}</span>
      </div>
      <style jsx>{`
        .portal-loading-screen {
          display: grid;
          min-height: 100vh;
          place-items: center;
          padding: 24px;
          background:
            linear-gradient(145deg, rgba(27, 43, 94, 0.96), rgba(92, 18, 32, 0.96)), #1b2b5e;
          color: #ffffff;
          font-family:
            'Plus Jakarta Sans',
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
        }

        .portal-loading-screen__panel {
          display: grid;
          justify-items: center;
          gap: 14px;
          text-align: center;
        }

        .portal-loading-screen__logo {
          display: grid;
          width: min(260px, 72vw);
          min-height: 112px;
          place-items: center;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(4, 9, 24, 0.35);
          animation: portalLogoPulse 1.8s ease-in-out infinite;
        }

        .portal-loading-screen__logo :global(img) {
          width: min(220px, 58vw);
          height: auto;
        }

        .portal-loading-screen p,
        .portal-loading-screen span {
          margin: 0;
        }

        .portal-loading-screen p {
          font-size: clamp(1rem, 3vw, 1.18rem);
          font-weight: 800;
          line-height: 1.25;
        }

        .portal-loading-screen__panel > span:last-child {
          color: rgba(255, 255, 255, 0.68);
          font-size: 0.78rem;
          font-weight: 700;
        }

        @keyframes portalLogoPulse {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }

          50% {
            transform: translateY(-4px) scale(1.02);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .portal-loading-screen__logo {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
