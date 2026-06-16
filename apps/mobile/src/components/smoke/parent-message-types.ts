import type { RouterOutputs } from '../../lib/trpc';

export type ConversationSummary = RouterOutputs['message']['listConversations']['items'][number];
export type ConversationDetail = RouterOutputs['message']['listConversationMessages'];
export type Recipient = RouterOutputs['message']['listRecipients'][number];
