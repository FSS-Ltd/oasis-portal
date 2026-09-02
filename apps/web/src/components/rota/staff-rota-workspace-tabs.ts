export const staffRotaWorkspaceTabs = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'availability', label: 'Availability' },
  { id: 'swap', label: 'Shift Swap' },
] as const;

export type StaffRotaWorkspaceTab = (typeof staffRotaWorkspaceTabs)[number]['id'];

export function nextStaffRotaWorkspaceTab(
  activeTab: StaffRotaWorkspaceTab,
  key: string,
): StaffRotaWorkspaceTab | null {
  const currentIndex = staffRotaWorkspaceTabs.findIndex((tab) => tab.id === activeTab);
  if (currentIndex < 0) return null;

  let nextIndex = currentIndex;
  if (key === 'ArrowRight') nextIndex = (currentIndex + 1) % staffRotaWorkspaceTabs.length;
  if (key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + staffRotaWorkspaceTabs.length) % staffRotaWorkspaceTabs.length;
  }
  if (key === 'Home') nextIndex = 0;
  if (key === 'End') nextIndex = staffRotaWorkspaceTabs.length - 1;

  return nextIndex === currentIndex ? null : (staffRotaWorkspaceTabs[nextIndex]?.id ?? null);
}
