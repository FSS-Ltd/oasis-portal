import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import {
  REALTIME_AREA_EXCLUSIONS,
  REALTIME_MODEL_COVERAGE,
  type RealtimeModelCoverage,
} from '../realtime/coverage.js';
import { REALTIME_AREAS } from '../realtime/events.js';

const schema = readFileSync(
  resolve(import.meta.dirname, '../../../db/prisma/schema.prisma'),
  'utf8',
);

describe('Realtime model coverage', () => {
  it('classifies every root router area and requires a read dependency or documented exclusion', () => {
    const path = resolve(import.meta.dirname, '../../../../apps/api/src/router.ts');
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest);
    const routers: string[] = [];
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'appRouter') continue;
        const initializer = declaration.initializer;
        if (!initializer || !ts.isCallExpression(initializer)) continue;
        const areas = initializer.arguments[0];
        if (!areas || !ts.isObjectLiteralExpression(areas)) continue;
        for (const property of areas.properties) {
          if (property.name && ts.isIdentifier(property.name)) routers.push(property.name.text);
        }
      }
    }
    expect(routers.sort()).toEqual([...REALTIME_AREAS].sort());
    const covered = new Set<string>(
      Object.values(REALTIME_MODEL_COVERAGE).flatMap((model) => model.areas),
    );
    expect(REALTIME_AREAS.filter((area) => !covered.has(area)).sort()).toEqual(
      Object.keys(REALTIME_AREA_EXCLUSIONS).sort(),
    );
    for (const reason of Object.values(REALTIME_AREA_EXCLUSIONS)) {
      expect(reason.length).toBeGreaterThan(20);
    }
  });
  it('classifies every Prisma model exactly once', () => {
    const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
    expect(Object.keys(REALTIME_MODEL_COVERAGE).sort()).toEqual(models.sort());
  });
  it('documents every operational exclusion and all audiences', () => {
    for (const item of Object.values<RealtimeModelCoverage>(REALTIME_MODEL_COVERAGE)) {
      expect(item.audience.length).toBeGreaterThan(0);
      if (item.areas.length === 0) expect(item.exclusion?.length).toBeGreaterThan(20);
    }
  });
  it('matches all dependency areas and audiences installed by the migration', () => {
    const sql = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../db/prisma/migrations/20261023150200_realtime_change_capture/migration.sql',
      ),
      'utf8',
    );
    for (const [model, coverage] of Object.entries(REALTIME_MODEL_COVERAGE)) {
      const values = coverage.areas.map((area) => `'${area}'`).join(',');
      expect(sql).toContain(`('${model}',ARRAY[${values}]::text[],'${coverage.audience}')`);
    }
  });
});
