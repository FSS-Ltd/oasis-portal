'use client';

import { Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { STANDARD_SCHOOL_YEARS, type StandardSchoolYear } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';

type BandForm = {
  name: string;
  colour: string;
  sortOrder: string;
  standardYears: StandardSchoolYear[];
};

type PolicyForm = {
  dailyTestLimitEnabled: boolean;
  maxTestsPerStudentPerDay: string;
  samePaceSameDayBlockEnabled: boolean;
  passThreshold: string;
};

const emptyBandForm: BandForm = {
  name: '',
  colour: '#5B90C5',
  sortOrder: '0',
  standardYears: [],
};

const defaultPolicyForm: PolicyForm = {
  dailyTestLimitEnabled: false,
  maxTestsPerStudentPerDay: '2',
  samePaceSameDayBlockEnabled: true,
  passThreshold: '80',
};

function toggleYear(years: StandardSchoolYear[], year: StandardSchoolYear) {
  return years.includes(year) ? years.filter((item) => item !== year) : [...years, year];
}

function normaliseColour(value: string) {
  return value.trim().toUpperCase();
}

function parseBandForm(form: BandForm) {
  return {
    name: form.name,
    colour: normaliseColour(form.colour),
    sortOrder: Number(form.sortOrder),
    standardYears: form.standardYears,
  };
}

export function AcademicSettingsClient() {
  const utils = api.useUtils();
  const bandsQuery = api.admin.listYearGroupBands.useQuery(undefined, { retry: false });
  const subjectsQuery = api.admin.listSubjects.useQuery(undefined, { retry: false });
  const policyQuery = api.admin.getPacePolicy.useQuery(undefined, { retry: false });

  const [bandForm, setBandForm] = useState<BandForm>(emptyBandForm);
  const [editingBandId, setEditingBandId] = useState<string | null>(null);
  const [editingBandForm, setEditingBandForm] = useState<BandForm>(emptyBandForm);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState('');
  const [policyForm, setPolicyForm] = useState<PolicyForm>(defaultPolicyForm);

  const activeSubjects = useMemo(
    () => (subjectsQuery.data ?? []).filter((subject) => subject.active),
    [subjectsQuery.data],
  );
  const inactiveSubjects = useMemo(
    () => (subjectsQuery.data ?? []).filter((subject) => !subject.active),
    [subjectsQuery.data],
  );

  const createBand = api.admin.createYearGroupBand.useMutation({
    async onSuccess() {
      setBandForm(emptyBandForm);
      await utils.admin.listYearGroupBands.invalidate();
    },
  });
  const updateBand = api.admin.updateYearGroupBand.useMutation({
    async onSuccess() {
      setEditingBandId(null);
      await utils.admin.listYearGroupBands.invalidate();
    },
  });
  const deactivateBand = api.admin.deactivateYearGroupBand.useMutation({
    async onSuccess() {
      await utils.admin.listYearGroupBands.invalidate();
    },
  });
  const createSubject = api.admin.createSubject.useMutation({
    async onSuccess() {
      setSubjectCode('');
      setSubjectName('');
      await Promise.all([
        utils.admin.listSubjects.invalidate(),
        utils.admin.listActiveSubjects.invalidate(),
      ]);
    },
  });
  const updateSubject = api.admin.updateSubject.useMutation({
    async onSuccess() {
      setEditingSubjectId(null);
      setEditingSubjectName('');
      await Promise.all([
        utils.admin.listSubjects.invalidate(),
        utils.admin.listActiveSubjects.invalidate(),
      ]);
    },
  });
  const deactivateSubject = api.admin.deactivateSubject.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.admin.listSubjects.invalidate(),
        utils.admin.listActiveSubjects.invalidate(),
      ]);
    },
  });
  const updatePolicy = api.admin.updatePacePolicy.useMutation({
    async onSuccess() {
      await utils.admin.getPacePolicy.invalidate();
    },
  });

  useEffect(() => {
    const policy = policyQuery.data;
    if (!policy) return;
    setPolicyForm({
      dailyTestLimitEnabled: policy.dailyTestLimitEnabled,
      maxTestsPerStudentPerDay: String(policy.maxTestsPerStudentPerDay),
      samePaceSameDayBlockEnabled: policy.samePaceSameDayBlockEnabled,
      passThreshold: String(policy.passThreshold),
    });
  }, [policyQuery.data]);

  return (
    <div className="settings-grid">
      <section className="panel settings-wide">
        <div className="panel__body">
          <div className="section-title">
            <h2>Standard school years</h2>
            <span className="badge">{STANDARD_SCHOOL_YEARS.length} years</span>
          </div>
          <div className="year-chip-grid" aria-label="Standard school years">
            {STANDARD_SCHOOL_YEARS.map((year) => (
              <span className="year-chip" key={year}>
                {year}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__body">
          <div className="section-title">
            <h2>Year-group bands</h2>
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              createBand.mutate(parseBandForm(bandForm));
            }}
          >
            <div className="form-grid form-grid--two">
              <Field label="Band name">
                <TextInput
                  onChange={(event) => setBandForm({ ...bandForm, name: event.target.value })}
                  value={bandForm.name}
                />
              </Field>
              <Field label="Band colour">
                <div className="colour-input">
                  <span
                    aria-hidden="true"
                    className="colour-swatch"
                    style={{ backgroundColor: bandForm.colour }}
                  />
                  <TextInput
                    pattern="^#[0-9a-fA-F]{6}$"
                    onChange={(event) =>
                      setBandForm({ ...bandForm, colour: normaliseColour(event.target.value) })
                    }
                    value={bandForm.colour}
                  />
                </div>
              </Field>
            </div>
            <Field label="Sort order">
              <TextInput
                min={0}
                onChange={(event) => setBandForm({ ...bandForm, sortOrder: event.target.value })}
                type="number"
                value={bandForm.sortOrder}
              />
            </Field>
            <div className="checkbox-grid" aria-label="Band school years">
              {STANDARD_SCHOOL_YEARS.map((year) => (
                <label
                  className={[
                    'checkbox-card',
                    bandForm.standardYears.includes(year) ? 'is-checked' : undefined,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={year}
                >
                  <input
                    checked={bandForm.standardYears.includes(year)}
                    onChange={() =>
                      setBandForm({
                        ...bandForm,
                        standardYears: toggleYear(bandForm.standardYears, year),
                      })
                    }
                    type="checkbox"
                  />
                  {year}
                </label>
              ))}
            </div>
            {createBand.error ? (
              <p className="status--error" role="alert">
                {createBand.error.message}
              </p>
            ) : null}
            {createBand.isSuccess ? <p className="status--success">Band saved</p> : null}
            <div>
              <Button pending={createBand.isPending} type="submit">
                <Save aria-hidden="true" size={16} />
                Create band
              </Button>
            </div>
          </form>

          <div className="divider" />
          {bandsQuery.isLoading ? <div className="empty-state">Loading bands...</div> : null}
          {bandsQuery.error ? (
            <p className="status--error" role="alert">
              {bandsQuery.error.message}
            </p>
          ) : null}
          <div className="academic-list">
            {(bandsQuery.data ?? []).map((band) => (
              <div className="academic-row academic-row--stack" key={band.id}>
                {editingBandId === band.id ? (
                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      updateBand.mutate({ id: band.id, ...parseBandForm(editingBandForm) });
                    }}
                  >
                    <div className="form-grid form-grid--two">
                      <Field label="Band name">
                        <TextInput
                          onChange={(event) =>
                            setEditingBandForm({
                              ...editingBandForm,
                              name: event.target.value,
                            })
                          }
                          value={editingBandForm.name}
                        />
                      </Field>
                      <Field label="Band colour">
                        <div className="colour-input">
                          <span
                            aria-hidden="true"
                            className="colour-swatch"
                            style={{ backgroundColor: editingBandForm.colour }}
                          />
                          <TextInput
                            pattern="^#[0-9a-fA-F]{6}$"
                            onChange={(event) =>
                              setEditingBandForm({
                                ...editingBandForm,
                                colour: normaliseColour(event.target.value),
                              })
                            }
                            value={editingBandForm.colour}
                          />
                        </div>
                      </Field>
                    </div>
                    <Field label="Sort order">
                      <TextInput
                        min={0}
                        onChange={(event) =>
                          setEditingBandForm({
                            ...editingBandForm,
                            sortOrder: event.target.value,
                          })
                        }
                        type="number"
                        value={editingBandForm.sortOrder}
                      />
                    </Field>
                    <div className="checkbox-grid" aria-label={`${band.name} school years`}>
                      {STANDARD_SCHOOL_YEARS.map((year) => (
                        <label
                          className={[
                            'checkbox-card',
                            editingBandForm.standardYears.includes(year)
                              ? 'is-checked'
                              : undefined,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          key={year}
                        >
                          <input
                            checked={editingBandForm.standardYears.includes(year)}
                            onChange={() =>
                              setEditingBandForm({
                                ...editingBandForm,
                                standardYears: toggleYear(editingBandForm.standardYears, year),
                              })
                            }
                            type="checkbox"
                          />
                          {year}
                        </label>
                      ))}
                    </div>
                    {updateBand.error ? (
                      <p className="status--error">{updateBand.error.message}</p>
                    ) : null}
                    <div className="row-actions">
                      <Button pending={updateBand.isPending} size="sm" type="submit">
                        Save band
                      </Button>
                      <Button
                        onClick={() => setEditingBandId(null)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <strong>{band.name}</strong>
                      <span>{band.standardYears.join(', ')}</span>
                    </div>
                    <span
                      className="colour-pill"
                      style={{ '--swatch': band.colour } as CSSProperties}
                    >
                      {band.colour}
                    </span>
                    <span className={band.active ? 'badge badge--green' : 'badge badge--amber'}>
                      {band.active ? 'Active' : 'Inactive'}
                    </span>
                    <div className="row-actions">
                      <Button
                        onClick={() => {
                          setEditingBandId(band.id);
                          setEditingBandForm({
                            name: band.name,
                            colour: band.colour,
                            sortOrder: String(band.sortOrder),
                            standardYears: band.standardYears as StandardSchoolYear[],
                          });
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Edit
                      </Button>
                      <Button
                        disabled={!band.active}
                        onClick={() => deactivateBand.mutate({ id: band.id })}
                        pending={deactivateBand.isPending}
                        size="sm"
                        type="button"
                        variant="danger"
                      >
                        <Trash2 aria-hidden="true" size={14} />
                        Deactivate
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__body">
          <div className="section-title">
            <h2>Subjects</h2>
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              createSubject.mutate({ code: subjectCode, name: subjectName });
            }}
          >
            <div className="form-grid form-grid--two">
              <Field label="Subject code">
                <TextInput
                  onChange={(event) => setSubjectCode(event.target.value)}
                  value={subjectCode}
                />
              </Field>
              <Field label="Subject name">
                <TextInput
                  onChange={(event) => setSubjectName(event.target.value)}
                  value={subjectName}
                />
              </Field>
            </div>
            {createSubject.error ? (
              <p className="status--error" role="alert">
                {createSubject.error.message}
              </p>
            ) : null}
            {createSubject.isSuccess ? <p className="status--success">Subject saved</p> : null}
            <div>
              <Button pending={createSubject.isPending} type="submit">
                <Save aria-hidden="true" size={16} />
                Create subject
              </Button>
            </div>
          </form>

          <div className="divider" />
          {subjectsQuery.isLoading ? <div className="empty-state">Loading subjects...</div> : null}
          {subjectsQuery.error ? (
            <p className="status--error" role="alert">
              {subjectsQuery.error.message}
            </p>
          ) : null}
          <div className="academic-list">
            {activeSubjects.map((subject) => (
              <div className="academic-row" key={subject.id}>
                <div>
                  <strong>{subject.code}</strong>
                  <span>{subject.name}</span>
                </div>
                {editingSubjectId === subject.id ? (
                  <form
                    className="inline-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      updateSubject.mutate({ id: subject.id, name: editingSubjectName });
                    }}
                  >
                    <TextInput
                      aria-label={`${subject.code} subject name`}
                      onChange={(event) => setEditingSubjectName(event.target.value)}
                      value={editingSubjectName}
                    />
                    <Button pending={updateSubject.isPending} size="sm" type="submit">
                      Save
                    </Button>
                  </form>
                ) : (
                  <div className="row-actions">
                    <Button
                      onClick={() => {
                        setEditingSubjectId(subject.id);
                        setEditingSubjectName(subject.name);
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => deactivateSubject.mutate({ id: subject.id })}
                      pending={deactivateSubject.isPending}
                      size="sm"
                      type="button"
                      variant="danger"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                      Deactivate
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {inactiveSubjects.map((subject) => (
              <div className="academic-row" key={subject.id}>
                <div>
                  <strong>{subject.code}</strong>
                  <span>{subject.name}</span>
                </div>
                <span className="badge badge--amber">Inactive</span>
              </div>
            ))}
          </div>
          {updateSubject.error ? <p className="status--error">{updateSubject.error.message}</p> : null}
          {updateSubject.isSuccess ? <p className="status--success">Subject updated</p> : null}
          {deactivateSubject.error ? (
            <p className="status--error">{deactivateSubject.error.message}</p>
          ) : null}
          {deactivateSubject.isSuccess ? (
            <p className="status--success">Subject deactivated</p>
          ) : null}
        </div>
      </section>

      <section className="panel settings-wide">
        <div className="panel__body">
          <div className="section-title">
            <h2>PACE policy</h2>
            <SlidersHorizontal aria-hidden="true" color="#5B90C5" size={18} />
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              updatePolicy.mutate({
                dailyTestLimitEnabled: policyForm.dailyTestLimitEnabled,
                maxTestsPerStudentPerDay: Number(policyForm.maxTestsPerStudentPerDay),
                samePaceSameDayBlockEnabled: policyForm.samePaceSameDayBlockEnabled,
                passThreshold: Number(policyForm.passThreshold),
              });
            }}
          >
            <div className="policy-grid">
              <label className="field">
                <span className="field__label">Daily test limit</span>
                <input
                  checked={policyForm.dailyTestLimitEnabled}
                  className="switch-input"
                  onChange={(event) =>
                    setPolicyForm({
                      ...policyForm,
                      dailyTestLimitEnabled: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
              </label>
              <Field label="Maximum tests per student per day">
                <TextInput
                  min={1}
                  max={20}
                  onChange={(event) =>
                    setPolicyForm({
                      ...policyForm,
                      maxTestsPerStudentPerDay: event.target.value,
                    })
                  }
                  type="number"
                  value={policyForm.maxTestsPerStudentPerDay}
                />
              </Field>
              <label className="field">
                <span className="field__label">Same-day self/final block</span>
                <input
                  checked={policyForm.samePaceSameDayBlockEnabled}
                  className="switch-input"
                  onChange={(event) =>
                    setPolicyForm({
                      ...policyForm,
                      samePaceSameDayBlockEnabled: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
              </label>
              <Field label="Pass threshold">
                <TextInput
                  min={1}
                  max={100}
                  onChange={(event) =>
                    setPolicyForm({ ...policyForm, passThreshold: event.target.value })
                  }
                  type="number"
                  value={policyForm.passThreshold}
                />
              </Field>
            </div>
            {policyQuery.error ? (
              <p className="status--error" role="alert">
                {policyQuery.error.message}
              </p>
            ) : null}
            {updatePolicy.error ? (
              <p className="status--error" role="alert">
                {updatePolicy.error.message}
              </p>
            ) : null}
            {updatePolicy.isSuccess ? <p className="status--success">PACE policy saved</p> : null}
            <div>
              <Button pending={updatePolicy.isPending} type="submit">
                <Save aria-hidden="true" size={16} />
                Save PACE policy
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
