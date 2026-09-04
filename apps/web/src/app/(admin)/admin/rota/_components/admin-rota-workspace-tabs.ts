const planningTabs = [
  { id: 'week', label: 'Week board' },
  { id: 'shifts', label: 'Shift editor' },
  { id: 'availability', label: 'Availability' },
  { id: 'swaps', label: 'Swap review' },
] as const;

const volunteerAccessTab = { id: 'volunteerAccess', label: 'Volunteer access' } as const;

export type AdminRotaWorkspaceTab =
  | (typeof planningTabs)[number]['id']
  | typeof volunteerAccessTab.id;

export type AdminRotaWorkspaceTabDescriptor = {
  id: AdminRotaWorkspaceTab;
  label: string;
};

export function adminRotaWorkspaceTabs(
  canManageVolunteerAccess: boolean,
): readonly AdminRotaWorkspaceTabDescriptor[] {
  return canManageVolunteerAccess ? [...planningTabs, volunteerAccessTab] : planningTabs;
}

export function nextAdminRotaWorkspaceTab(
  activeTab: AdminRotaWorkspaceTab,
  key: string,
  tabs: readonly AdminRotaWorkspaceTabDescriptor[],
): AdminRotaWorkspaceTab | null {
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  if (activeIndex === -1) {
    return null;
  }

  if (key === 'Home') {
    return tabs[0]?.id ?? null;
  }

  if (key === 'End') {
    return tabs.at(-1)?.id ?? null;
  }

  if (key === 'ArrowRight') {
    return tabs[(activeIndex + 1) % tabs.length]?.id ?? null;
  }

  if (key === 'ArrowLeft') {
    return tabs[(activeIndex - 1 + tabs.length) % tabs.length]?.id ?? null;
  }

  return null;
}
