import { Archive, CalendarDays, Pencil, Trash2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  audienceLabels,
  categoryClassNames,
  categoryLabels,
  eventDayLabel,
  formatEventSchedule,
  type CalendarEvent,
} from './calendar-model';

interface CalendarEventCardProps {
  canAssignRequiredPeople: boolean;
  canDelete: boolean;
  canManage: boolean;
  event: CalendarEvent;
  onArchive: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  onEdit: (event: CalendarEvent) => void;
  onView?: (event: CalendarEvent) => void;
  pendingArchive: boolean;
  pendingDelete: boolean;
}

export function CalendarEventCard({
  canAssignRequiredPeople,
  canDelete,
  canManage,
  event,
  onArchive,
  onDelete,
  onEdit,
  onView,
  pendingArchive,
  pendingDelete,
}: CalendarEventCardProps) {
  const canEdit =
    canManage &&
    event.source === 'Manual' &&
    (event.audience !== 'Custom' || canAssignRequiredPeople);
  const canPermanentlyDelete = canEdit && canDelete;

  return (
    <article className={event.active ? 'calendar-card' : 'calendar-card is-archived'}>
      <div
        className={`calendar-card__date ${categoryClassNames[event.category]}`}
        aria-hidden="true"
      >
        <CalendarDays size={18} />
        <strong>{eventDayLabel(event)}</strong>
      </div>
      <div className="calendar-card__body">
        <div className="calendar-card__head">
          <div>
            <span className="badge-list">
              <span className="badge badge--blue">{audienceLabels[event.audience]}</span>
              <span className={`calendar-category-badge ${categoryClassNames[event.category]}`}>
                {categoryLabels[event.category]}
              </span>
              {!event.active ? <span className="badge">Archived</span> : null}
            </span>
            <h2>{event.title}</h2>
          </div>
          {canEdit ? (
            <div className="calendar-card__actions">
              <Button
                aria-label={`Edit ${event.title}`}
                onClick={() => {
                  onEdit(event);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Pencil aria-hidden="true" size={14} />
                Edit
              </Button>
              {event.active ? (
                <Button
                  aria-label={`Archive ${event.title}`}
                  onClick={() => {
                    onArchive(event.id);
                  }}
                  pending={pendingArchive}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Archive aria-hidden="true" size={14} />
                  Archive
                </Button>
              ) : null}
              {canPermanentlyDelete ? (
                <Button
                  aria-label={`Delete ${event.title}`}
                  onClick={() => {
                    onDelete(event.id);
                  }}
                  pending={pendingDelete}
                  size="sm"
                  type="button"
                  variant="danger"
                >
                  <Trash2 aria-hidden="true" size={14} />
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null}
          {!canManage && onView ? (
            <Button
              aria-label={`View ${event.title}`}
              onClick={() => {
                onView(event);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              View
            </Button>
          ) : null}
        </div>
        <p className="calendar-card__date-line">{formatEventSchedule(event)}</p>
        {event.requiredPeople.length > 0 ? (
          <div className="calendar-required-summary">
            <UsersRound aria-hidden="true" size={14} />
            <span>Needed: {event.requiredPeople.map((person) => person.fullName).join(', ')}</span>
          </div>
        ) : null}
        {event.description ? <p>{event.description}</p> : null}
      </div>
    </article>
  );
}
