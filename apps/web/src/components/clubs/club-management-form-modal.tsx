'use client';

import { type FormEvent } from 'react';
import { Plus, RefreshCw, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { clubAccentValueStyle, type Club, type ClubFormState } from './club-management-model';
import { CLUB_ACCENTS, CLUB_ICON_OPTIONS, clubVisual, randomClubAccent } from './club-visuals';

export function ClubFormModal({
  club,
  error,
  form,
  onClose,
  onFormChange,
  onSubmit,
  pending,
}: {
  club: Club | null;
  error: string | null;
  form: ClubFormState;
  onClose: () => void;
  onFormChange: (form: ClubFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
}) {
  const visual = clubVisual({
    accentColor: form.accentColor,
    iconKey: form.iconKey,
    id: club?.id ?? (form.name.trim() || 'new-club'),
    name: form.name.trim() || club?.name || 'New club',
  });
  const PreviewIcon = visual.Icon;

  return (
    <div className="pace-modal-backdrop club-modal-backdrop">
      <section
        aria-labelledby="club-form-modal-title"
        aria-modal="true"
        className="pace-modal admin-club-form-modal"
        role="dialog"
      >
        <header
          className="admin-club-form-modal__header"
          style={clubAccentValueStyle(visual.accent)}
        >
          <span className="admin-club-form-modal__icon">
            <PreviewIcon aria-hidden="true" size={28} />
          </span>
          <span>
            <small>{club ? 'Edit club' : 'Create club'}</small>
            <h2 id="club-form-modal-title">{form.name.trim() || club?.name || 'New club'}</h2>
          </span>
          <Button
            aria-label="Close club form"
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" size={16} />
          </Button>
        </header>
        <form
          className="admin-club-form-modal__body"
          onSubmit={(event) => {
            onSubmit(event);
          }}
        >
          <Field label="Club name" required>
            <TextInput
              maxLength={160}
              onChange={(event) => {
                onFormChange({ ...form, name: event.target.value });
              }}
              placeholder="Drama Club"
              required
              value={form.name}
            />
          </Field>
          <Field label="Description" hint="Optional">
            <textarea
              className="input textarea"
              maxLength={1000}
              onChange={(event) => {
                onFormChange({ ...form, description: event.target.value });
              }}
              placeholder="Short club description"
              rows={3}
              value={form.description}
            />
          </Field>
          <div className="admin-club-visual-picker">
            <div className="admin-club-visual-picker__header">
              <span>
                <strong>Icon</strong>
                <small>{CLUB_ICON_OPTIONS.find((option) => option.key === form.iconKey)?.label}</small>
              </span>
            </div>
            <div className="admin-club-icon-grid" aria-label="Choose club icon">
              {CLUB_ICON_OPTIONS.map((option) => {
                const Icon = option.Icon;
                const selected = form.iconKey === option.key;
                return (
                  <button
                    aria-label={option.label}
                    aria-pressed={selected}
                    className={selected ? 'is-selected' : ''}
                    key={option.key}
                    onClick={() => {
                      onFormChange({ ...form, iconKey: option.key });
                    }}
                    style={clubAccentValueStyle(form.accentColor)}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={20} />
                  </button>
                );
              })}
            </div>
            <div className="admin-club-visual-picker__header">
              <span>
                <strong>Colour</strong>
                <small>{form.accentColor}</small>
              </span>
              <Button
                onClick={() => {
                  onFormChange({ ...form, accentColor: randomClubAccent() });
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                <RefreshCw aria-hidden="true" size={14} />
                Shuffle
              </Button>
            </div>
            <div className="admin-club-colour-grid" aria-label="Choose club colour">
              {CLUB_ACCENTS.map((accent) => (
                <button
                  aria-label={accent}
                  aria-pressed={form.accentColor === accent}
                  className={form.accentColor === accent ? 'is-selected' : ''}
                  key={accent}
                  onClick={() => {
                    onFormChange({ ...form, accentColor: accent });
                  }}
                  style={clubAccentValueStyle(accent)}
                  type="button"
                />
              ))}
            </div>
          </div>
          <div className="form-grid form-grid--two">
            <Field label="First club date" required>
              <TextInput
                onChange={(event) => {
                  onFormChange({ ...form, scheduleDate: event.target.value });
                }}
                required
                type="date"
                value={form.scheduleDate}
              />
            </Field>
            <Field label="Capacity" hint="Leave blank for no cap">
              <TextInput
                inputMode="numeric"
                min={1}
                onChange={(event) => {
                  onFormChange({ ...form, capacity: event.target.value });
                }}
                placeholder="20"
                type="number"
                value={form.capacity}
              />
            </Field>
          </div>
          <div className="form-grid form-grid--two">
            <Field label="Start time" required>
              <TextInput
                onChange={(event) => {
                  onFormChange({ ...form, scheduleStartTime: event.target.value });
                }}
                required
                type="time"
                value={form.scheduleStartTime}
              />
            </Field>
            <Field label="End time" required>
              <TextInput
                onChange={(event) => {
                  onFormChange({ ...form, scheduleEndTime: event.target.value });
                }}
                required
                type="time"
                value={form.scheduleEndTime}
              />
            </Field>
          </div>
          <div className="clubs-form__actions admin-club-form-modal__actions">
            <Button pending={pending} type="submit">
              {club ? <Save aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />}
              {club ? 'Save club' : 'Create club'}
            </Button>
            <Button onClick={onClose} type="button" variant="secondary">
              Cancel
            </Button>
          </div>
          {error ? <p className="status--error">{error}</p> : null}
        </form>
      </section>
    </div>
  );
}
