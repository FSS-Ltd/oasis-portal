import type { RouterOutputs } from '@/lib/trpc';

export type MessageMode = 'admin' | 'parent' | 'supervisor';
export type ConversationKind = 'ParentStaff' | 'SupervisorHead' | 'StaffDirect' | 'StudentDirect';
export type AdminRecipientScope = 'staff' | 'parents';
export type ConversationPage = RouterOutputs['message']['listConversations'];
export type LoadedConversationPage = { cursor: string | undefined; page: ConversationPage };
export type ConversationSummary = ConversationPage['items'][number];
export type ConversationDetail = RouterOutputs['message']['listConversationMessages'];
export type Recipient = RouterOutputs['message']['listRecipients'][number];
