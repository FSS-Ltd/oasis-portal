import { Download } from 'lucide-react';

const DEFAULT_MOBILE_PWA_URL = 'https://app.oasisportal.space';

type DownloadAppLinkVariant = 'sidebar' | 'topbar' | 'mobile';

interface DownloadAppLinkProps {
  variant: DownloadAppLinkVariant;
}

export function DownloadAppLink({ variant }: DownloadAppLinkProps) {
  const href = process.env.NEXT_PUBLIC_MOBILE_PWA_URL || DEFAULT_MOBILE_PWA_URL;
  const label = variant === 'mobile' ? 'App' : 'Download app';

  return (
    <a
      aria-label="Download the Oasis mobile app"
      className={`download-app-link download-app-link--${variant}`}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <Download aria-hidden="true" size={variant === 'mobile' ? 17 : 15} />
      <span>{label}</span>
    </a>
  );
}
