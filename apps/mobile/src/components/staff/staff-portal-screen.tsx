import { useState } from 'react';
import { type RouterOutputs } from '../../lib/trpc';
import { StaffAttendanceScreen } from './staff-attendance-screen';
import { StaffBehaviourScreen } from './staff-behaviour-screen';
import { StaffCommunicationsScreen } from './staff-communications-screen';
import { StaffHomeScreen } from './staff-home-screen';
import { StaffIncidentScreen } from './staff-incident-screen';
import { StaffPaceScreen } from './staff-pace-screen';
import { StaffRotaScreen } from './staff-rota-screen';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StaffPortalRoute =
  | 'home'
  | 'attendance'
  | 'behaviour'
  | 'communications'
  | 'incidents'
  | 'pace'
  | 'rota';

export function StaffPortalScreen({ user }: { user: SessionUser | undefined }) {
  const [route, setRoute] = useState<StaffPortalRoute>('home');

  if (route === 'attendance') {
    return (
      <StaffAttendanceScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

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

  if (route === 'behaviour') {
    return (
      <StaffBehaviourScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'pace') {
    return (
      <StaffPaceScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'incidents') {
    return (
      <StaffIncidentScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'rota') {
    return (
      <StaffRotaScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  return (
    <StaffHomeScreen
      onOpenAttendance={() => {
        setRoute('attendance');
      }}
      onOpenBehaviour={() => {
        setRoute('behaviour');
      }}
      onOpenCommunications={() => {
        setRoute('communications');
      }}
      onOpenIncidents={() => {
        setRoute('incidents');
      }}
      onOpenPace={() => {
        setRoute('pace');
      }}
      onOpenRota={() => {
        setRoute('rota');
      }}
      user={user}
    />
  );
}
