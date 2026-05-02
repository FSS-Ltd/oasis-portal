'use client';

import { Search } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { directoryFilters, type DirectoryFilter, type DirectoryItem } from './people-profile-model';

interface PeopleDirectoryProps {
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
  filter,
  items,
  loading,
  onFilterChange,
  onSearchChange,
  onSelect,
  search,
  selectedKey,
}: PeopleDirectoryProps) {
  return (
    <aside className="people-directory panel" aria-label="People directory">
      <div className="people-directory__filters" role="tablist">
        {directoryFilters.map((option) => (
          <button
            aria-selected={filter === option.id}
            className={filter === option.id ? 'is-selected' : undefined}
            key={option.id}
            onClick={() => {
              onFilterChange(option.id);
            }}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="people-directory__search">
        <Search aria-hidden="true" size={15} />
        <span className="sr-only">Search people</span>
        <input
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
          placeholder="Search people..."
          type="search"
          value={search}
        />
      </label>
      <div className="people-directory__list">
        {loading ? <div className="empty-state">Loading people...</div> : null}
        {!loading && items.length === 0 ? (
          <EmptyState detail="Try another filter or invite a new person." title="No people found" />
        ) : null}
        {items.map((item, index) => (
          <button
            className={
              item.key === selectedKey ? 'people-directory-row is-active' : 'people-directory-row'
            }
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
              <strong>{item.title}</strong>
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
