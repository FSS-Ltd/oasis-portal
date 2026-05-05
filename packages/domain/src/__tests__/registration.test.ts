import { describe, expect, it, vi } from 'vitest';
import { parentInitialRegistrationInput } from '../registration.js';

function validConsent(initials = 'JF') {
  return { granted: true, initials };
}

function validStudent(name = 'Jane Learner') {
  return {
    fullName: name,
    preferredName: 'Jane',
    dob: new Date('2016-03-04T00:00:00.000Z'),
    gender: 'Female',
    yearGroup: 'Year 5',
    startDate: new Date('2026-04-27T00:00:00.000Z'),
    homeLanguage: 'English',
    studentNotes: 'Routine notes',
    allergies: 'N/A',
    medicalConditions: 'N/A',
    medicationAtCentre: 'N/A',
    dietaryRestrictions: 'N/A',
    learningSupport: 'N/A',
    interestsStrengths: 'Reading',
    settlingComfortNotes: 'Quiet transitions',
    additionalInfo: 'N/A',
    consents: {
      Contact: validConsent(),
      EmergencyMedical: validConsent(),
      LocalActivities: validConsent(),
      PhotoVideo: validConsent(),
      Accuracy: validConsent(),
    },
  };
}

function validPayload() {
  return {
    homeAddress: '12 Oasis Road, London',
    guardianContacts: [
      {
        fullName: 'Parent One',
        relationship: 'Mother',
        primaryPhone: '07123456789',
        secondaryPhone: '',
        email: 'Parent@One.COM',
        workPhone: '',
        address: '',
      },
    ],
    emergencyContacts: [
      {
        fullName: 'Emergency One',
        relationship: 'Aunt',
        primaryPhone: '07987654321',
        secondaryPhone: '',
        email: '',
        canPickUp: true,
      },
    ],
    pickupContacts: [],
    students: [validStudent()],
    agreement: {
      guardianName: 'Parent One',
      agreementDate: new Date('2026-04-27T00:00:00.000Z'),
    },
  };
}

describe('parentInitialRegistrationInput', () => {
  it('accepts the registration form and normalises optional blanks', () => {
    const parsed = parentInitialRegistrationInput.parse(validPayload());

    expect(parsed.guardianContacts[0]?.email).toBe('parent@one.com');
    expect(parsed.guardianContacts[0]?.secondaryPhone).toBeUndefined();
    expect(parsed.students[0]?.consents.Accuracy.initials).toBe('JF');
  });

  it('allows up to six siblings and rejects a seventh', () => {
    const payload = validPayload();
    payload.students = Array.from({ length: 6 }, (_, index) =>
      validStudent(`Student ${String(index + 1)}`),
    );
    expect(parentInitialRegistrationInput.safeParse(payload).success).toBe(true);

    payload.students.push(validStudent('Student 7'));
    const result = parentInitialRegistrationInput.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['students']);
    }
  });

  it('requires every consent answer and initials', () => {
    const payload = validPayload();
    payload.students[0] = {
      ...validStudent(),
      consents: {
        Contact: validConsent(),
        EmergencyMedical: validConsent(),
        LocalActivities: validConsent(),
        PhotoVideo: validConsent(),
      } as never,
    };

    const result = parentInitialRegistrationInput.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['students', 0, 'consents', 'Accuracy']);
    }
  });

  it('restricts gender to Male or Female', () => {
    const payload = validPayload();
    payload.students[0] = {
      ...validStudent(),
      gender: 'Prefer not to say',
    };

    const result = parentInitialRegistrationInput.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['students', 0, 'gender']);
    }
  });

  it('rejects future dates for birth date and agreement date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-05T12:00:00.000Z'));
    try {
      const payload = validPayload();
      payload.students[0] = {
        ...validStudent(),
        dob: new Date('2026-05-06T00:00:00.000Z'),
      };
      payload.agreement.agreementDate = new Date('2026-05-06T00:00:00.000Z');

      const result = parentInitialRegistrationInput.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.path)).toEqual(
          expect.arrayContaining([
            ['students', 0, 'dob'],
            ['agreement', 'agreementDate'],
          ]),
        );
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
