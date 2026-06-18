import { useState } from 'react';
import { type RouterOutputs } from '../../lib/trpc';
import { StaffCommunicationsScreen } from './staff-communications-screen';
import { StaffHomeScreen } from './staff-home-screen';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StaffPortalRoute = 'home' | 'communications';

export function StaffPortalScreen({ user }: { user: SessionUser | undefined }) {
  const [route, setRoute] = useState<StaffPortalRoute>('home');

  if (route === 'communications') {
    return (
      <StaffCommunicationsScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  return (
    <StaffHomeScreen
      onOpenCommunications={() => {
        setRoute('communications');
      }}
      user={user}
    />
  );
}
