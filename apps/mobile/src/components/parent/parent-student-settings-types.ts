import type { RouterOutputs } from '../../lib/trpc';

export type LinkedChildSettings =
  RouterOutputs['studentSettings']['listLinkedChildren'][number];

export type PreparedChildIconPhoto =
  RouterOutputs['studentSettings']['prepareChildIconPhotoUpload'];
