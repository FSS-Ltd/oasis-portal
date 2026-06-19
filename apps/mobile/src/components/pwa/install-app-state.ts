export type PwaInstallSurface = 'browserPrompt' | 'iosInstructions' | 'hidden';

interface StandaloneInput {
  displayModeStandalone: boolean;
  navigatorStandalone: unknown;
}

interface InstallSurfaceInput {
  hasBeforeInstallPrompt: boolean;
  isStandalone: boolean;
  maxTouchPoints: number;
  userAgent: string;
}

interface InstallAppCopy {
  detail: string;
  label: string;
  title: string;
}

export function isRunningStandalone({
  displayModeStandalone,
  navigatorStandalone,
}: StandaloneInput): boolean {
  return displayModeStandalone || navigatorStandalone === true;
}

export function detectPwaInstallSurface({
  hasBeforeInstallPrompt,
  isStandalone,
  maxTouchPoints,
  userAgent,
}: InstallSurfaceInput): PwaInstallSurface {
  if (isStandalone) return 'hidden';
  if (hasBeforeInstallPrompt) return 'browserPrompt';

  const isIosDevice = /iPad|iPhone|iPod/.test(userAgent);
  const isTouchMac = /Macintosh/.test(userAgent) && maxTouchPoints > 1;

  return isIosDevice || isTouchMac ? 'iosInstructions' : 'hidden';
}

export function getInstallAppCopy(surface: PwaInstallSurface): InstallAppCopy {
  if (surface === 'browserPrompt') {
    return {
      detail: 'Install Oasis on this device for a full-screen app experience.',
      label: 'Install app',
      title: 'Install Oasis',
    };
  }

  if (surface === 'iosInstructions') {
    return {
      detail: 'Open Share in Safari, then choose Add to Home Screen.',
      label: 'How to install',
      title: 'Add Oasis to Home Screen',
    };
  }

  return {
    detail: '',
    label: '',
    title: '',
  };
}
