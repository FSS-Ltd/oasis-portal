export type PwaInstallSurface =
  | 'androidInstructions'
  | 'browserPrompt'
  | 'iosInstructions'
  | 'hidden';

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
  const isAndroidDevice = /Android/.test(userAgent);

  if (isAndroidDevice) return 'androidInstructions';
  return isIosDevice || isTouchMac ? 'iosInstructions' : 'hidden';
}

export function getInstallAppCopy(surface: PwaInstallSurface): InstallAppCopy {
  if (surface === 'browserPrompt') {
    return {
      detail: 'Install Oasis on this device for a full-screen app experience.',
      label: 'Download app',
      title: 'Install Oasis',
    };
  }

  if (surface === 'iosInstructions') {
    return {
      detail: 'Open Share in Safari, then choose Add to Home Screen.',
      label: 'Download app',
      title: 'Add Oasis to Home Screen',
    };
  }

  if (surface === 'androidInstructions') {
    return {
      detail: 'Open the browser menu, then choose Install app or Add to Home screen.',
      label: 'Download app',
      title: 'Add Oasis to Home Screen',
    };
  }

  return {
    detail: '',
    label: '',
    title: '',
  };
}
