'use client';

import { LogOut } from 'lucide-react';
import { useClerk } from '@clerk/nextjs';

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  const { signOut } = useClerk();

  return (
    <button
      className={className ?? 'logout-button'}
      onClick={() => {
        void signOut({ redirectUrl: '/sign-in' });
      }}
      type="button"
    >
      <LogOut aria-hidden="true" size={16} />
      <span>Log out</span>
    </button>
  );
}
