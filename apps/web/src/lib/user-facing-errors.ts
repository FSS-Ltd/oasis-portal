const GENERIC_ERROR_MESSAGE =
  'Something went wrong. Try again, or contact an administrator if it continues.';
const NETWORK_ERROR_MESSAGE = 'We could not reach Oasis. Check your connection and try again.';
const NOT_FOUND_ERROR_MESSAGE =
  'We could not find that record. It may have been removed or you may no longer have access.';
const PERMISSION_ERROR_MESSAGE = 'You do not have permission to do that.';
const SIGN_IN_ERROR_MESSAGE = 'Please sign in again to continue.';
const EMAIL_ERROR_MESSAGE =
  'The record was saved, but the email could not be sent. Try resending it.';
const VALIDATION_ERROR_MESSAGE = 'Check the details and try again.';

type ErrorLikeRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ErrorLikeRecord {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function messageFromUnknown(error: unknown): string | null {
  if (typeof error === 'string') return stringValue(error);
  if (error instanceof Error) return stringValue(error.message);
  if (!isRecord(error)) return null;

  const directMessage = stringValue(error['message']);
  if (directMessage) return directMessage;

  const nestedError = error['error'];
  if (typeof nestedError === 'string') return stringValue(nestedError);
  if (isRecord(nestedError)) {
    return stringValue(nestedError['message']) ?? stringValue(nestedError['error']);
  }

  return null;
}

function codeFromUnknown(error: unknown): string | null {
  if (!isRecord(error)) return null;

  const directCode = stringValue(error['code']);
  if (directCode) return directCode;

  const data = error['data'];
  if (isRecord(data)) return stringValue(data['code']);

  return null;
}

function cleanMessage(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  if (!trimmed) return GENERIC_ERROR_MESSAGE;

  const withSentenceStart = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(withSentenceStart) ? withSentenceStart : `${withSentenceStart}.`;
}

function isInternalFailure(message: string): boolean {
  return [
    'app_url',
    'clerk',
    'config',
    'connectorerror',
    'decrypt',
    'encrypt',
    'env',
    'internal',
    'kms',
    'lookup failed',
    'missing id',
    'new row violates',
    'pii',
    'postgres',
    'prisma',
    'query execution',
    'queryerror',
    'row-level security',
    'rls',
    'source_payload',
    'unknown error',
    'webhook',
  ].some((term) => message.includes(term));
}

function mapKnownDomainMessage(message: string): string | null {
  if (message.includes('email address is already in use')) {
    return 'That email address is already in use.';
  }
  if (message.includes('date of birth cannot be in the future')) {
    return 'Date of birth cannot be in the future.';
  }
  if (message.includes('enter a valid date')) {
    return 'Enter a valid date.';
  }
  if (message.includes('from must be on or before to')) {
    return 'Start date must be on or before end date.';
  }
  if (message.includes('absencereason is required')) {
    return 'Add an absence reason before saving.';
  }
  if (message.includes('insufficient stock')) {
    return 'There is not enough stock available.';
  }
  if (
    message.includes('insufficient spend balance') ||
    message.includes('insufficient source balance')
  ) {
    return 'There are not enough Spend merits available.';
  }
  if (message.includes('insufficient investment units')) {
    return 'There are not enough investment units available.';
  }
  if (message.includes('student is inactive') || message.includes('student is not active')) {
    return 'This student is inactive.';
  }
  if (message.includes('subject is inactive') || message.includes('subject is not active')) {
    return 'This subject is inactive.';
  }
  if (message.includes('item is inactive')) {
    return 'This shop item is inactive.';
  }
  if (message.includes('cannot access merit shop') && message.includes('most recent tithe')) {
    return 'You cannot access Merit Shop until you have given your most recent tithe.';
  }
  if (message.includes('tithe due before merit shop opens')) {
    return 'You cannot access Merit Shop until you have given your most recent tithe.';
  }
  if (message.includes('reservation is not ready')) {
    return 'This reservation is not ready yet.';
  }
  if (message.includes('only pdf invoices can be uploaded')) {
    return 'Upload a PDF invoice file.';
  }
  if (message.includes('invoice pdf file is required')) {
    return 'Choose a PDF invoice before uploading.';
  }
  if (message.includes('invalid pdf upload size')) {
    return 'The invoice PDF is too large or empty.';
  }
  if (message.includes('capacity cannot be below active signup count')) {
    return 'Capacity cannot be lower than the current number of signups.';
  }
  if (message.includes('cannot request a swap with yourself')) {
    return 'Choose another supervisor for the swap.';
  }
  if (message.includes('shift already has a pending swap')) {
    return 'This shift already has a pending swap request.';
  }
  if (message.includes('availability windows must not overlap')) {
    return 'Availability times must not overlap.';
  }
  if (message.includes('sent reports cannot be re-drafted')) {
    return 'Sent reports cannot be drafted again.';
  }
  if (message.includes('sent reports cannot be reviewed')) {
    return 'Sent reports cannot be reviewed again.';
  }
  if (message.includes('term report is already sent')) {
    return 'This report has already been sent.';
  }
  if (message.includes('approved advancement records cannot be deleted')) {
    return 'Approved advancement records cannot be deleted.';
  }
  if (message.includes('only failed pace tests can be approved for advancement')) {
    return 'Only failed PACE Tests can be approved for advancement.';
  }
  if (message.includes('cannot record pace test before a self-test')) {
    return 'Record the Self-Test before adding the PACE Test.';
  }
  if (message.includes('cannot update pace test without a self-test')) {
    return 'Record the Self-Test before updating the PACE Test.';
  }
  if (message.includes('approved advancement must match the current pace number')) {
    return 'The approved advancement must match the current PACE number.';
  }
  if (message.includes('this invitation has already been accepted')) {
    return 'This invitation has already been accepted.';
  }
  if (message.includes('cannot deactivate your own account')) {
    return 'You cannot deactivate your own account.';
  }
  if (message.includes('cannot change your own role')) {
    return 'You cannot change your own role.';
  }

  return null;
}

function messageForCode(code: string | null, fallback: string): string | null {
  if (!code) return null;

  const normalizedCode = code.toUpperCase();
  if (normalizedCode === 'UNAUTHORIZED') return SIGN_IN_ERROR_MESSAGE;
  if (normalizedCode === 'FORBIDDEN') return PERMISSION_ERROR_MESSAGE;
  if (normalizedCode === 'NOT_FOUND') return NOT_FOUND_ERROR_MESSAGE;
  if (normalizedCode === 'INTERNAL_SERVER_ERROR') return GENERIC_ERROR_MESSAGE;
  if (normalizedCode === 'BAD_REQUEST') return fallback;

  return null;
}

export function friendlyErrorMessage(error: unknown, fallback = GENERIC_ERROR_MESSAGE): string {
  const rawMessage = messageFromUnknown(error);
  const code = codeFromUnknown(error);

  if (!rawMessage) return messageForCode(code, fallback) ?? fallback;

  const normalizedMessage = rawMessage.toLowerCase();

  if (
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('enotfound') ||
    normalizedMessage.includes('econnrefused')
  ) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (
    normalizedMessage.includes('sign-in required') ||
    normalizedMessage.includes('unauthorized')
  ) {
    return SIGN_IN_ERROR_MESSAGE;
  }
  if (
    normalizedMessage.includes('forbidden') ||
    normalizedMessage.includes('access denied') ||
    normalizedMessage.includes('permission')
  ) {
    return PERMISSION_ERROR_MESSAGE;
  }
  if (normalizedMessage.includes('email send failed') || normalizedMessage.includes('resend')) {
    return EMAIL_ERROR_MESSAGE;
  }
  if (
    normalizedMessage.startsWith('[') ||
    normalizedMessage.includes('invalid_type') ||
    normalizedMessage.includes('invalid literal')
  ) {
    return VALIDATION_ERROR_MESSAGE;
  }

  const mappedDomainMessage = mapKnownDomainMessage(normalizedMessage);
  if (mappedDomainMessage) return mappedDomainMessage;

  if (isInternalFailure(normalizedMessage)) return GENERIC_ERROR_MESSAGE;
  if (normalizedMessage.includes('not found')) return NOT_FOUND_ERROR_MESSAGE;

  return messageForCode(code, cleanMessage(rawMessage)) ?? cleanMessage(rawMessage);
}
