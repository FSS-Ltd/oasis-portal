import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import { makeTestContext } from './helpers/test-context.js';
import { personalTaskRouter } from '../routers/personalTask.js';
import { router } from '../trpc.js';

const supervisor: SessionUser = {
  id: 'user_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const anotherSupervisor: SessionUser = {
  id: 'user_another_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const technicalSupport: SessionUser = {
  id: 'user_technical_support',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};
const parent: SessionUser = { id: 'user_parent', role: 'Parent', tags: [], requires2fa: false };

interface StoredTask {
  id: string;
  ownerId: string;
  title: string;
  dueAt: Date | null;
  reminderAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeDb {
  personalTask: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function at(value: string): Date {
  return new Date(value);
}

function makeFakeDb() {
  const tasks: StoredTask[] = [
    {
      id: 'task_supervisor',
      ownerId: supervisor.id,
      title: 'Prepare the room',
      dueAt: at('2026-09-01T10:00:00.000Z'),
      reminderAt: null,
      completedAt: null,
      createdAt: at('2026-08-31T08:00:00.000Z'),
      updatedAt: at('2026-08-31T08:00:00.000Z'),
    },
    {
      id: 'task_other',
      ownerId: anotherSupervisor.id,
      title: 'Private task',
      dueAt: null,
      reminderAt: null,
      completedAt: null,
      createdAt: at('2026-08-31T09:00:00.000Z'),
      updatedAt: at('2026-08-31T09:00:00.000Z'),
    },
  ];
  const db: FakeDb = {
    personalTask: {
      findMany: vi.fn(({ where }: { where: { ownerId: string } }) =>
        Promise.resolve(tasks.filter((task) => task.ownerId === where.ownerId)),
      ),
      create: vi.fn(
        ({ data }: { data: Pick<StoredTask, 'ownerId' | 'title' | 'dueAt' | 'reminderAt'> }) => {
          const task: StoredTask = {
            id: `task_${String(tasks.length + 1)}`,
            completedAt: null,
            createdAt: at('2026-08-31T10:00:00.000Z'),
            updatedAt: at('2026-08-31T10:00:00.000Z'),
            ...data,
          };
          tasks.push(task);
          return Promise.resolve(task);
        },
      ),
      findFirst: vi.fn(({ where }: { where: { id: string; ownerId: string } }) =>
        Promise.resolve(
          tasks.find((task) => task.id === where.id && task.ownerId === where.ownerId) ?? null,
        ),
      ),
      update: vi.fn(
        ({ where, data }: { where: { id: string }; data: Pick<StoredTask, 'completedAt'> }) => {
          const task = tasks.find((candidate) => candidate.id === where.id);
          if (!task) throw new Error('task missing');
          Object.assign(task, data, { updatedAt: at('2026-08-31T10:05:00.000Z') });
          return Promise.resolve(task);
        },
      ),
    },
  };

  return { db, tasks };
}

function makeCaller(user: SessionUser | null, db: FakeDb) {
  return router({ personalTask: personalTaskRouter }).createCaller(
    makeTestContext({ db, rls: { kind: 'db', db }, user }),
  );
}

describe('personal tasks', () => {
  it('keeps task lists and completion changes scoped to the signed-in staff member', async () => {
    const { db, tasks } = makeFakeDb();
    const caller = makeCaller(supervisor, db);

    await expect(caller.personalTask.list()).resolves.toMatchObject([
      { id: 'task_supervisor', ownerId: supervisor.id },
    ]);

    await expect(
      caller.personalTask.create({
        dueAt: new Date('2026-09-02T11:00:00.000Z'),
        reminderAt: new Date('2026-09-02T10:30:00.000Z'),
        title: 'Check stock',
      }),
    ).resolves.toMatchObject({ ownerId: supervisor.id, title: 'Check stock' });

    await expect(
      caller.personalTask.setCompleted({ completed: true, id: 'task_other' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tasks.find((task) => task.id === 'task_other')?.completedAt).toBeNull();

    await expect(
      caller.personalTask.setCompleted({ completed: true, id: 'task_supervisor' }),
    ).resolves.toMatchObject({ id: 'task_supervisor' });
    expect(tasks.find((task) => task.id === 'task_supervisor')?.completedAt).toBeInstanceOf(Date);
  });

  it('rejects non-staff users and blank titles', async () => {
    const { db } = makeFakeDb();

    await expect(makeCaller(parent, db).personalTask.list()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      makeCaller(supervisor, db).personalTask.create({ title: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('allows Technical Support users to manage their own private tasks', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(technicalSupport, db).personalTask.create({ title: 'Review account issue' }),
    ).resolves.toMatchObject({ ownerId: technicalSupport.id, title: 'Review account issue' });
  });
});
