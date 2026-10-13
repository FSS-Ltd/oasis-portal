import { mergeRouters } from '../trpc.js';
import { userAgreementAdminRouter } from './userAgreementAdmin.js';
import { userAgreementRecipientRouter } from './userAgreementRecipient.js';

export const userAgreementRouter = mergeRouters(
  userAgreementAdminRouter,
  userAgreementRecipientRouter,
);
