import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, ErrorText, Field, MutedText, SectionTitle, MobileButton } from '../core/mobile-ui';
import {
  parsePositiveByteSize,
  type PreparedHomeworkUpload,
  type StudentHomeworkAssignment,
} from './student-homework-activity-utils';

interface StudentHomeworkActivitySubmitPanelProps {
  assignment: StudentHomeworkAssignment;
  onSubmitted: () => Promise<void>;
}

const submitErrorMessage = 'Work could not be submitted.';

export function StudentHomeworkActivitySubmitPanel({
  assignment,
  onSubmitted,
}: StudentHomeworkActivitySubmitPanelProps) {
  const utils = api.useUtils();
  const prepareUpload = api.homework.prepareUpload.useMutation();
  const submitUpload = api.homework.submitUpload.useMutation();
  const [fileName, setFileName] = useState('');
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [sizeBytes, setSizeBytes] = useState('');
  const [preparedImage, setPreparedImage] = useState<PreparedHomeworkUpload | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFileName('');
    setMimeType('image/jpeg');
    setPreparedImage(null);
    setSizeBytes('');
    setStatus(null);
    setError(null);
  }, [assignment.id]);

  if (assignment.reviewedAt !== null) return null;

  if (assignment.submissionMethod === 'InPerson') {
    return (
      <View style={styles.statusPanel}>
        <Badge variant="warning">Hand in person</Badge>
        <MutedText>Hand this homework to your Head or supervisor.</MutedText>
      </View>
    );
  }

  const busy = prepareUpload.isPending || submitUpload.isPending;
  const submitted = assignment.submittedAt !== null;

  async function prepareImageUpload() {
    setError(null);
    setStatus(null);
    const parsedSize = parsePositiveByteSize(sizeBytes);
    if (!fileName.trim() || !mimeType.trim() || parsedSize === null) {
      setError('Enter a file name, MIME type, and positive byte size before preparing an upload.');
      return;
    }

    try {
      const prepared = await prepareUpload.mutateAsync({
        assignmentId: assignment.id,
        files: [{ fileName: fileName.trim(), mimeType: mimeType.trim(), sizeBytes: parsedSize }],
      });
      setPreparedImage(prepared.images[0] ?? null);
      setStatus('Upload image prepared.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : submitErrorMessage);
    }
  }

  async function confirmSubmittedWork() {
    if (!preparedImage) return;
    setError(null);
    setStatus('Submitting work');

    try {
      await submitUpload.mutateAsync({
        assignmentId: assignment.id,
        image: {
          fileName: preparedImage.fileName,
          mimeType: preparedImage.mimeType,
          sizeBytes: preparedImage.sizeBytes,
          storageBucket: preparedImage.storageBucket,
          storagePath: preparedImage.storagePath,
        },
      });
      setPreparedImage(null);
      setStatus('Submission pending');
      await Promise.all([
        utils.homework.studentDue.invalidate(),
        utils.homework.studentGraded.invalidate(),
        onSubmitted(),
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : submitErrorMessage);
      setStatus(null);
    }
  }

  return (
    <View style={styles.submitPanel}>
      <View style={styles.sectionTitleGroup}>
        <Text style={styles.eyebrow}>Submit work</Text>
        <SectionTitle>{submitted ? 'Upload another image' : 'Upload image'}</SectionTitle>
      </View>
      <MutedText>
        Prepare the image slot, upload the file to Oasis storage, then confirm it here.
      </MutedText>
      <Field label="Image file name" onChangeText={setFileName} value={fileName} />
      <Field label="Image MIME type" onChangeText={setMimeType} value={mimeType} />
      <Field
        keyboardType="numeric"
        label="Image size bytes"
        onChangeText={setSizeBytes}
        value={sizeBytes}
      />
      <MobileButton
        disabled={busy}
        label={prepareUpload.isPending ? 'Submitting work' : 'Prepare image upload'}
        onPress={() => {
          void prepareImageUpload();
        }}
        variant="secondary"
      />
      {preparedImage ? (
        <View style={styles.statusPanel}>
          <Text style={styles.smallStrong}>Upload prepared</Text>
          <MutedText>Upload the selected file, then confirm the submitted homework image.</MutedText>
          <MobileButton
            disabled={busy}
            label={submitUpload.isPending ? 'Submitting work' : 'Confirm submitted work'}
            onPress={() => {
              void confirmSubmittedWork();
            }}
            variant="primary"
          />
        </View>
      ) : null}
      {busy && !status ? <MutedText>Submitting work</MutedText> : null}
      {status ? <MutedText>{status}</MutedText> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionTitleGroup: {
    gap: 3,
  },
  smallStrong: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  statusPanel: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  submitPanel: {
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
});
