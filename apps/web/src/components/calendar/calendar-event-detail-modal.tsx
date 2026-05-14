import { CalendarDays, UsersRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  audienceLabels,
  categoryClassNames,
  categoryLabels,
  formatEventSchedule,
  type CalendarEvent,
} from './calendar-model';

interface CalendarEventDetailModalProps {
  event: CalendarEvent;
  onClose: () => void;
}

export function CalendarEventDetailModal({ event, onClose }: CalendarEventDetailModalProps) {
  return (
    <div
      aria-labelledby="calendar-detail-title"
      aria-modal="true"
      className="calendar-detail-backdrop"
      role="dialog"
    >
      <article className="calendar-detail-modal">
        <header className={`calendar-detail-modal__header ${categoryClassNames[event.category]}`}>
          <div>
            <span>{categoryLabels[event.category]}</span>
            <h2 id="calendar-detail-title">{event.title}</h2>
          </div>
          <Button aria-label="Close event details" onClick={onClose} type="button" variant="ghost">
            <X aria-hidden="true" size={16} />
          </Button>
        </header>
        <div className="calendar-detail-modal__body">
          <p className="calendar-detail-modal__date">
            <CalendarDays aria-hidden="true" size={16} />
            {formatEventSchedule(event)}
          </p>
          <div className="badge-list">
            <span className="badge badge--blue">{audienceLabels[event.audience]}</span>
            <span className={`calendar-category-badge ${categoryClassNames[event.category]}`}>
              {categoryLabels[event.category]}
            </span>
          </div>
          {event.requiredPeople.length > 0 ? (
            <div className="calendar-detail-required">
              <UsersRound aria-hidden="true" size={16} />
              <div>
                <strong>Needed</strong>
                <span>{event.requiredPeople.map((person) => person.fullName).join(', ')}</span>
              </div>
            </div>
          ) : null}
          {event.description ? <p>{event.description}</p> : null}
        </div>
      </article>
    </div>
  );
}
