export async function uploadAgreement(form: FormData): Promise<void> {
  const response = await fetch('/api/user-agreements/upload', { method: 'POST', body: form });
  if (!response.ok) {
    const body: unknown = await response.json();
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Agreement upload failed.';
    throw new Error(message);
  }
}
