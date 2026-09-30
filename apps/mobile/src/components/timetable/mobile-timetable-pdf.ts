import { saveOrSharePdf, type ShareablePdf } from './mobile-pdf-file';

export async function saveOrShareTimetablePdf(pdf: ShareablePdf): Promise<void> {
  await saveOrSharePdf(pdf, 'Print or save timetable');
}
