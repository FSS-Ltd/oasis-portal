import type { RouterOutputs } from '../../lib/trpc';

export type ConversationSummary = RouterOutputs['message']['listConversations']['items'][number];
export type ConversationDetail = RouterOutputs['message']['listConversationMessages'];
export type ConversationMessage = ConversationDetail['messages'][number];
export type Recipient = RouterOutputs['message']['listRecipients'][number];

export type ConversationKind = 'ParentStaff' | 'StudentDirect' | 'StaffDirect' | 'SupervisorHead';

/** A set of people someone can start a conversation with, all sharing one conversation kind. */
export interface RecipientGroup {
  kind: ConversationKind;
  label: string;
  recipients: Recipient[];
}
