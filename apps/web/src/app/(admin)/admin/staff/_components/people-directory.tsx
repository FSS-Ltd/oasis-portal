'use client';

import { useId } from 'react';
import { Search, X } from 'lucide-react';
import type { AdultComplianceBadgeSummary } from '@oasis/domain';
import { ComplianceBadges } from '@/components/compliance/compliance-badges';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import styles from '../people-profiles.module.css';
import { directoryFilters, type DirectoryFilter, type DirectoryItem } from './people-profile-model';

interface PeopleDirectoryProps {
  badgesByUserId: ReadonlyMap<string, AdultComplianceBadgeSummary>;
  filter: DirectoryFilter;
  items: readonly DirectoryItem[];
  loading: boolean;
  onFilterChange: (filter: DirectoryFilter) => void;
  onSearchChange: (search: string) => void;
  onSelect: (key: string) => void;
  search: string;
  selectedKey: string;
}

export function PeopleDirectory({
  badgesByUserId,
  filter,
  items,
  loading,
  onFilterChange,
  onSearchChange,
  onSelect,
  search,
  selectedKey,
}: PeopleDirectoryProps) {
  const searchId = useId();

  return (
    <aside className="people-directory panel" aria-label="People directory">
      <div className={styles.directoryHeading}>
        <h3>{filter === 'inactive' ? 'Inactive profiles' : 'Current profiles'}</h3>
        <span aria-live="polite">{loading ? '…' : items.length}</span>
      </div>
      <div
        className={cn('people-directory__filters', styles.filters)}
        role="group"
        aria-label="Filter people"
      >
        {directoryFilters.map((option) => (
          <button
            aria-pressed={filter === option.id}
            className={filter === option.id ? 'is-selected' : undefined}
            key={option.id}
            onClick={() => {
              onFilterChange(option.id);
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="people-directory__search">
        <Search aria-hidden="true" size={15} />
        <label className="sr-only" htmlFor={searchId}>
          Search people
        </label>
        <input
          id={searchId}
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
          placeholder="Search people..."
          type="search"
          value={search}
        />
        {search ? (
          <button
            aria-label="Clear search"
            className={styles.clearSearch}
            onClick={() => {
              onSearchChange('');
            }}
            type="button"
          >
            <X aria-hidden="true" size={14} />
          </button>
        ) : null}
      </div>
      <div className="people-directory__list">
        {loading ? <div className="empty-state">Loading people...</div> : null}
        {!loading && items.length === 0 ? (
          <EmptyState
            detail="Try another search or choose a different people filter."
            title={
              filter === 'inactive' ? 'No inactive profiles found' : 'No current profiles found'
            }
          />
        ) : null}
        {items.map((item, index) => (
          <button
            className={
              item.key === selectedKey ? 'people-directory-row is-active' : 'people-directory-row'
            }
            aria-pressed={item.key === selectedKey}
            key={item.key}
            onClick={() => {
              onSelect(item.key);
            }}
            type="button"
          >
            <Avatar
              className={`people-avatar people-avatar--${item.kind === 'invite' ? 'supervisor' : item.kind}`}
              index={index}
              name={item.title}
            />
            <span>
              <span className="people-directory-row__identity">
                <strong>{item.title}</strong>
                {item.kind === 'student' ? (
                  <ComplianceBadges
                    summary={badgesByUserId.get(item.student.userId ?? '') ?? null}
                  />
                ) : item.kind === 'parent' || item.kind === 'supervisor' ? (
                  <ComplianceBadges summary={badgesByUserId.get(item.user.id) ?? null} />
                ) : null}
              </span>
              <small>
                <i aria-hidden="true" />
                {item.subtitle}
                {item.kind === 'invite' ? <Badge tone="amber">Pending</Badge> : null}
              </small>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
