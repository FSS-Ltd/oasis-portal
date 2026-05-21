'use client';

import { Save, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { StandardSchoolYear } from '@oasis/domain';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import {
  PacePolicyPanel,
  StandardYearsPanel,
  type PolicyForm,
} from './_components/academic-panels';
import {
  formatSchoolYearList,
  standardSchoolYearOptions,
  standardSchoolYearsFrom,
} from './_components/school-year-options';

type YearGroupBand = {
  active: boolean;
  colour: string;
  id: string;
  name: string;
  sortOrder: number;
  standardYears: string[];
};

type Subject = {
  active: boolean;
  code: string;
  id: string;
  name: string;
};

type BandForm = {
  name: string;
  colour: string;
  sortOrder: string;
  standardYears: StandardSchoolYear[];
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

  const bands = useMemo<YearGroupBand[]>(() => bandsQuery.data ?? [], [bandsQuery.data]);
  const subjects = useMemo<Subject[]>(() => subjectsQuery.data ?? [], [subjectsQuery.data]);

  const activeSubjects = useMemo<Subject[]>(
    () => subjects.filter((subject: Subject) => subject.active),
    [subjects],
  );
  const inactiveSubjects = useMemo<Subject[]>(
    () => subjects.filter((subject: Subject) => !subject.active),
    [subjects],
  );

  const createBand = api.admin.createYearGroupBand.useMutation({
    async onSuccess() {
      setBandForm(emptyBandForm);
      showSuccessToast('Band saved.');
      await utils.admin.listYearGroupBands.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Band could not be saved.');
    },
  });
  const updateBand = api.admin.updateYearGroupBand.useMutation({
    async onSuccess() {
      setEditingBandId(null);
      showSuccessToast('Band updated.');
      await utils.admin.listYearGroupBands.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Band could not be updated.');
    },
  });
  const deactivateBand = api.admin.deactivateYearGroupBand.useMutation({
    async onSuccess() {
      showSuccessToast('Band deactivated.');
      await utils.admin.listYearGroupBands.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Band could not be deactivated.');
    },
  });
  const createSubject = api.admin.createSubject.useMutation({
    async onSuccess() {
      setSubjectCode('');
      setSubjectName('');
      showSuccessToast('Subject saved.');
      await Promise.all([
        utils.admin.listSubjects.invalidate(),
        utils.admin.listActiveSubjects.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Subject could not be saved.');
    },
  });
  const updateSubject = api.admin.updateSubject.useMutation({
    async onSuccess() {
      setEditingSubjectId(null);
      setEditingSubjectName('');
      showSuccessToast('Subject updated.');
      await Promise.all([
        utils.admin.listSubjects.invalidate(),
        utils.admin.listActiveSubjects.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Subject could not be updated.');
    },
  });
  const deactivateSubject = api.admin.deactivateSubject.useMutation({
    async onSuccess() {
      showSuccessToast('Subject deactivated.');
      await Promise.all([
        utils.admin.listSubjects.invalidate(),
        utils.admin.listActiveSubjects.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Subject could not be deactivated.');
    },
  });
  const updatePolicy = api.admin.updatePacePolicy.useMutation({
    async onSuccess() {
      showSuccessToast('PACE policy saved.');
      await utils.admin.getPacePolicy.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'PACE policy could not be saved.');
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
      <StandardYearsPanel yearCount={standardSchoolYearOptions.length} />

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
                  onChange={(event) => {
                    setBandForm({ ...bandForm, name: event.target.value });
                  }}
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
                    onChange={(event) => {
                      setBandForm({ ...bandForm, colour: normaliseColour(event.target.value) });
                    }}
                    value={bandForm.colour}
                  />
                </div>
              </Field>
            </div>
            <Field label="Sort order">
              <TextInput
                min={0}
                onChange={(event) => {
                  setBandForm({ ...bandForm, sortOrder: event.target.value });
                }}
                type="number"
                value={bandForm.sortOrder}
              />
            </Field>
            <div className="checkbox-grid" aria-label="Band school years">
              {standardSchoolYearOptions.map(({ label, year }) => (
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
                    onChange={() => {
                      setBandForm({
                        ...bandForm,
                        standardYears: toggleYear(bandForm.standardYears, year),
                      });
                    }}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>
            {createBand.error ? (
              <p className="status--error" role="alert">
                {friendlyErrorMessage(createBand.error)}
              </p>
            ) : null}
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
              {friendlyErrorMessage(bandsQuery.error)}
            </p>
          ) : null}
          <div className="academic-list">
            {bands.map((band: YearGroupBand) => (
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
                          onChange={(event) => {
                            setEditingBandForm({
                              ...editingBandForm,
                              name: event.target.value,
                            });
                          }}
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
                            onChange={(event) => {
                              setEditingBandForm({
                                ...editingBandForm,
                                colour: normaliseColour(event.target.value),
                              });
                            }}
                            value={editingBandForm.colour}
                          />
                        </div>
                      </Field>
                    </div>
                    <Field label="Sort order">
                      <TextInput
                        min={0}
                        onChange={(event) => {
                          setEditingBandForm({
                            ...editingBandForm,
                            sortOrder: event.target.value,
                          });
                        }}
                        type="number"
                        value={editingBandForm.sortOrder}
                      />
                    </Field>
                    <div className="checkbox-grid" aria-label={`${band.name} school years`}>
                      {standardSchoolYearOptions.map(({ label, year }) => (
                        <label
                          className={[
                            'checkbox-card',
                            editingBandForm.standardYears.includes(year) ? 'is-checked' : undefined,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          key={year}
                        >
                          <input
                            checked={editingBandForm.standardYears.includes(year)}
                            onChange={() => {
                              setEditingBandForm({
                                ...editingBandForm,
                                standardYears: toggleYear(editingBandForm.standardYears, year),
                              });
                            }}
                            type="checkbox"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {updateBand.error ? (
                      <p className="status--error">{friendlyErrorMessage(updateBand.error)}</p>
                    ) : null}
                    <div className="row-actions">
                      <Button pending={updateBand.isPending} size="sm" type="submit">
                        Save band
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingBandId(null);
                        }}
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
                      <span>{formatSchoolYearList(band.standardYears)}</span>
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
                            standardYears: standardSchoolYearsFrom(band.standardYears),
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
                        onClick={() => {
                          deactivateBand.mutate({ id: band.id });
                        }}
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
                  onChange={(event) => {
                    setSubjectCode(event.target.value);
                  }}
                  value={subjectCode}
                />
              </Field>
              <Field label="Subject name">
                <TextInput
                  onChange={(event) => {
                    setSubjectName(event.target.value);
                  }}
                  value={subjectName}
                />
              </Field>
            </div>
            {createSubject.error ? (
              <p className="status--error" role="alert">
                {friendlyErrorMessage(createSubject.error)}
              </p>
            ) : null}
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
              {friendlyErrorMessage(subjectsQuery.error)}
            </p>
          ) : null}
          <div className="academic-list">
            {activeSubjects.map((subject: Subject) => (
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
                      onChange={(event) => {
                        setEditingSubjectName(event.target.value);
                      }}
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
                      onClick={() => {
                        deactivateSubject.mutate({ id: subject.id });
                      }}
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
            {inactiveSubjects.map((subject: Subject) => (
              <div className="academic-row" key={subject.id}>
                <div>
                  <strong>{subject.code}</strong>
                  <span>{subject.name}</span>
                </div>
                <span className="badge badge--amber">Inactive</span>
              </div>
            ))}
          </div>
          {updateSubject.error ? (
            <p className="status--error">{friendlyErrorMessage(updateSubject.error)}</p>
          ) : null}
          {deactivateSubject.error ? (
            <p className="status--error">{friendlyErrorMessage(deactivateSubject.error)}</p>
          ) : null}
        </div>
      </section>

      <PacePolicyPanel
        form={policyForm}
        onChange={setPolicyForm}
        onSubmit={() => {
          updatePolicy.mutate({
            dailyTestLimitEnabled: policyForm.dailyTestLimitEnabled,
            maxTestsPerStudentPerDay: Number(policyForm.maxTestsPerStudentPerDay),
            samePaceSameDayBlockEnabled: policyForm.samePaceSameDayBlockEnabled,
            passThreshold: Number(policyForm.passThreshold),
          });
        }}
        policyError={policyQuery.error ? friendlyErrorMessage(policyQuery.error) : undefined}
        saveError={updatePolicy.error ? friendlyErrorMessage(updatePolicy.error) : undefined}
        savePending={updatePolicy.isPending}
      />
    </div>
  );
}
