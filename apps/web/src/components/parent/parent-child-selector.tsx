'use client';

import type { CSSProperties } from 'react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { avatarColour, firstName, getInitials, SNAPSHOT_AVATAR_COLOURS } from '@/lib/display';

export interface ParentChildSelectorOption {
  fullName: string;
  iconPhotoUrl?: string | null;
  id: string;
  yearGroup: string;
}

interface ParentChildSelectorProps {
  children: readonly ParentChildSelectorOption[];
  className?: string;
  onSelect: (studentId: string) => void;
  selectedChildId: string;
}

export function ParentChildSelector({
  children,
  className,
  onSelect,
  selectedChildId,
}: ParentChildSelectorProps) {
  if (children.length <= 1) return null;

  return (
    <div className={`parent-child-selector${className ? ` ${className}` : ''}`}>
      <span>Child</span>
      <div className="parent-child-selector__list" aria-label="Select child">
        {children.map((child, index) => {
          const colour = avatarColour(index, SNAPSHOT_AVATAR_COLOURS);
          const selected = child.id === selectedChildId;

          return (
            <button
              aria-pressed={selected}
              className={selected ? 'is-selected' : ''}
              key={child.id}
              onClick={() => {
                onSelect(child.id);
              }}
              style={{ '--student-colour': colour } as CSSProperties}
              type="button"
            >
              {child.iconPhotoUrl ? (
                <span
                  aria-hidden="true"
                  className="parent-child-selector__photo"
                  style={{ backgroundImage: `url("${child.iconPhotoUrl}")` }}
                />
              ) : (
                <small>{getInitials(child.fullName)}</small>
              )}
              <strong>{firstName(child.fullName)}</strong>
              <em>{displaySchoolYearLabel(child.yearGroup)}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}
