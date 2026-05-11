import type { RouterOutputs } from '../../lib/trpc';

export type ThreadSummary = RouterOutputs['message']['listThreads'][number];
export type ThreadDetail = RouterOutputs['message']['listInThread'];
export type Recipient = RouterOutputs['message']['listRecipients'][number];
