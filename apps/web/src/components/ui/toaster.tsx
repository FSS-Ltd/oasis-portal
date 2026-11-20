'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      closeButton
      duration={4000}
      // Bottom-right keeps page headers and counts visible; on phones it clears the tab bar.
      mobileOffset={{ bottom: 88, left: 16, right: 16 }}
      offset={24}
      position="bottom-right"
      richColors
      toastOptions={{
        classNames: {
          actionButton: 'oasis-toast__action',
          cancelButton: 'oasis-toast__cancel',
          closeButton: 'oasis-toast__close',
          description: 'oasis-toast__description',
          title: 'oasis-toast__title',
          toast: 'oasis-toast',
        },
      }}
    />
  );
}

