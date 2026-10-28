import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface ShareablePdf {
  fileName: string;
  mimeType: 'application/pdf';
  pdfBase64: string;
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/gu, '-').replace(/-+/gu, '-');
}

export async function saveOrSharePdf(pdf: ShareablePdf, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    const response = await fetch(`data:${pdf.mimeType};base64,${pdf.pdfBase64}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeFileName(pdf.fileName);
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, safeFileName(pdf.fileName));
  file.create({ overwrite: true });
  file.write(pdf.pdfBase64, { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    dialogTitle,
    mimeType: pdf.mimeType,
    UTI: 'com.adobe.pdf',
  });
}
