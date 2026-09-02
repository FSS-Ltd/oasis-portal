import { dateKey, dayLabels, formatDateLabel, type RotaDayAvailabilitySummary } from './rota-utils';

type RotaAvailabilityBoardProps = {
  errorMessage?: string | undefined;
  isLoading: boolean;
  staffAvailabilityByDay: readonly RotaDayAvailabilitySummary[];
  weekDays: readonly Date[];
};

export function RotaAvailabilityBoard({
  errorMessage,
  isLoading,
  staffAvailabilityByDay,
  weekDays,
}: RotaAvailabilityBoardProps) {
  return (
    <section
      aria-labelledby="rota-availability-board-title"
      className="panel rota-availability-board"
    >
      <div className="panel__body">
        <div className="section-title">
          <div>
            <p className="staff-rota-eyebrow">Coverage planning</p>
            <h2 id="rota-availability-board-title">Team availability</h2>
          </div>
        </div>
        <p className="muted">
          Use this view to identify staff who can cover each day before creating a shift.
        </p>
        {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        <div className="rota-availability-week-grid">
          {weekDays.map((day) => {
            const key = dateKey(day);
            const availability = staffAvailabilityByDay.find((summary) => summary.date === key);
            return (
              <article className="rota-availability-day" key={key}>
                <header>
                  <span>{dayLabels[day.getUTCDay()]}</span>
                  <strong>{formatDateLabel(day)}</strong>
                </header>
                {isLoading ? (
                  <span className="rota-availability-badge is-empty">Loading availability</span>
                ) : null}
                {!isLoading ? (
                  <div className="rota-availability-badges" aria-label={`Availability for ${key}`}>
                    <div>
                      <span className="rota-availability-badges__label">Available</span>
                      {availability?.available.length ? (
                        availability.available.map((staff) => (
                          <span className="rota-availability-badge is-available" key={staff.id}>
                            {staff.label}
                            <small>{staff.detail}</small>
                          </span>
                        ))
                      ) : (
                        <span className="rota-availability-badge is-empty">None set</span>
                      )}
                    </div>
                    <div>
                      <span className="rota-availability-badges__label">Unavailable</span>
                      {availability?.unavailable.length ? (
                        availability.unavailable.map((staff) => (
                          <span className="rota-availability-badge is-unavailable" key={staff.id}>
                            {staff.label}
                            <small>{staff.detail}</small>
                          </span>
                        ))
                      ) : (
                        <span className="rota-availability-badge is-empty">None set</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
