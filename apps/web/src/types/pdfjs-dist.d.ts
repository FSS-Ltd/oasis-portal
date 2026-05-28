declare module 'pdfjs-dist/legacy/webpack.mjs' {
  interface PdfTextContent {
    items: unknown[];
  }

  interface PdfPage {
    getTextContent: () => Promise<PdfTextContent>;
  }

  interface PdfDocument {
    numPages: number;
    getPage: (pageNumber: number) => Promise<PdfPage>;
  }

  interface PdfLoadingTask {
    promise: Promise<PdfDocument>;
  }

  export function getDocument(input: {
    data: Uint8Array;
    isEvalSupported: boolean;
  }): PdfLoadingTask;
}
