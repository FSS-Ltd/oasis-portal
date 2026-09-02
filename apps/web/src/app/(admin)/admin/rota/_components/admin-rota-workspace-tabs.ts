export const adminRotaWorkspaceTabs = [
  { id: 'week', label: 'Week board' },
  { id: 'shifts', label: 'Shift editor' },
  { id: 'availability', label: 'Availability' },
  { id: 'swaps', label: 'Swap review' },
] as const;

export type AdminRotaWorkspaceTab = (typeof adminRotaWorkspaceTabs)[number]['id'];

const lastAdminRotaWorkspaceTab = adminRotaWorkspaceTabs.reduce((_, tab) => tab);

export function nextAdminRotaWorkspaceTab(
  activeTab: AdminRotaWorkspaceTab,
  key: string,
): AdminRotaWorkspaceTab | null {
  const activeIndex = adminRotaWorkspaceTabs.findIndex((tab) => tab.id === activeTab);

  if (activeIndex === -1) {
    return null;
  }

  if (key === 'Home') {
    return adminRotaWorkspaceTabs[0].id;
  }

  if (key === 'End') {
    return lastAdminRotaWorkspaceTab.id;
  }

  if (key === 'ArrowRight') {
    return adminRotaWorkspaceTabs[(activeIndex + 1) % adminRotaWorkspaceTabs.length]?.id ?? null;
  }

  if (key === 'ArrowLeft') {
    return (
      adminRotaWorkspaceTabs[
        (activeIndex - 1 + adminRotaWorkspaceTabs.length) % adminRotaWorkspaceTabs.length
      ]?.id ?? null
    );
  }

  return null;
}
