// Page: Artifacts — the user's stored files (uploads + generated CV PDFs).
// Reads/writes: the framework files table + MinIO (REST), owner-scoped.
// Authenticated (PrivateRoute); each user sees only their own, admin sees all.

import React, { useState } from 'react';
import { IonButton, IonItem, IonLabel, IonInput, IonText, IonSpinner } from '@ionic/react';
import { documentTextOutline } from 'ionicons/icons';
import ApiService from '../../services/Api';
import { FileRecord } from '../../interfaces/types';
import SplitPageLayout from '../../components/shell/SplitPageLayout';
import TabPanel from '../../components/shell/TabPanel';
import ResourcePanel from '../../components/shell/ResourcePanel';
import ModalShell from '../../components/shell/ModalShell';
import EmptyState from '../../components/shell/EmptyState';
import PdfViewer from '../../components/shell/PdfViewer';
import { downloadBlob } from '../../utils/download';
import { AREA_NAV, PANEL_CONFIG } from '../../constants';


/*
 ██    ██  ████████  ██        ██████    ████████  ██████      ██████
 ██    ██  ██        ██        ██    ██  ██        ██    ██  ██
 ████████  ██████    ██        ██████    ██████    ██████      ████
 ██    ██  ██        ██        ██        ██        ██    ██        ██
 ██    ██  ████████  ████████  ██        ████████  ██    ██  ██████
                                                                       */


const formatDate = (val: string) => { const d = new Date(val); return isNaN(d.getTime()) ? val : d.toLocaleString(); };
const fileMeta = (f: FileRecord) =>
  [f.size ? `${Math.max(1, Math.round(f.size / 1024))} KB` : null, formatDate(f.created_at)].filter(Boolean).join(' · ');


const Artifacts: React.FC = () => {


/*
   ██████  ██████████    ████    ██████████  ████████
 ██            ██      ██    ██      ██      ██
   ████        ██      ████████      ██      ██████
       ██      ██      ██    ██      ██      ██
 ██████        ██      ██    ██      ██      ████████
                                                       */


  const [version, setVersion]           = useState(0);
  const [selected, setSelected]         = useState<FileRecord | null>(null);
  const [previewBlob, setPreviewBlob]   = useState<Blob | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  // Upload modal
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [uploadFile, setUploadFile]     = useState<File | null>(null);
  const [uploadDesc, setUploadDesc]     = useState('');
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null);
  const [deleting, setDeleting]         = useState(false);


/*
 ██          ████      ████    ██████
 ██        ██    ██  ██    ██  ██    ██
 ██        ██    ██  ████████  ██    ██
 ██        ██    ██  ██    ██  ██    ██
 ████████    ████    ██    ██  ██████
                                         */


  const selectFile = async (f: FileRecord) => {
    setSelected(f); setError(''); setPreviewBlob(null); setLoading(true);
    try {
      setPreviewBlob(await ApiService.fetchFileBlob(f.id));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };


/*
 ██    ██    ████    ██      ██  ██████    ██        ████████  ██████      ██████
 ██    ██  ██    ██  ████    ██  ██    ██  ██        ██        ██    ██  ██
 ████████  ████████  ██  ██  ██  ██    ██  ██        ██████    ██████      ████
 ██    ██  ██    ██  ██    ████  ██    ██  ██        ██        ██    ██        ██
 ██    ██  ██    ██  ██      ██  ██████    ████████  ████████  ██    ██  ██████
                                                                                   */


  // Reuses the already-loaded preview bytes — no second fetch.
  const handleDownload = () => {
    if (!selected || !previewBlob) return;
    downloadBlob(previewBlob, selected.filename);
  };

  const openUpload = () => { setUploadFile(null); setUploadDesc(''); setUploadError(''); setUploadOpen(true); };
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true); setUploadError('');
    try {
      await ApiService.uploadFile(uploadFile, uploadDesc || undefined);
      setUploadOpen(false);
      setVersion(v => v + 1);
    } catch (e: any) {
      setUploadError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await ApiService.deleteFile(deleteTarget.id);
      if (selected?.id === deleteTarget.id) { setSelected(null); setPreviewBlob(null); }
      setDeleteTarget(null);
      setVersion(v => v + 1);
    } finally {
      setDeleting(false);
    }
  };


/*
 ██████    ████████  ██      ██  ██████    ████████  ██████
 ██    ██  ██        ████    ██  ██    ██  ██        ██    ██
 ██████    ██████    ██  ██  ██  ██    ██  ██████    ██████
 ██    ██  ██        ██    ████  ██    ██  ██        ██    ██
 ██    ██  ████████  ██      ██  ██████    ████████  ██    ██
                                                               */


  return (
    <SplitPageLayout
      navItems={AREA_NAV.APPLICATIONS}
      title="Job Applications"
      rightHeader={
        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ion-color-medium)' }}>
          <strong style={{ color: 'var(--ion-text-color)' }}>Artifacts</strong>
          {' — '}every file you have uploaded or generated. Preview and download here; attach them to
          applications from an application's detail.
        </div>
      }
      leftTabs={[
        {
          label: 'Artifacts',
          content: (
            /* ═══════════════════════════════════════════════════════════
                 Asset list                                                */
            <ResourcePanel<FileRecord>
              fetcher={ApiService.getFiles}
              refreshToken={version}
              config={PANEL_CONFIG.USER_FILES}
              selectedId={selected?.id}
              getLabel={f => f.filename}
              getSubLabel={fileMeta}
              getIcon={() => documentTextOutline}
              onSelect={selectFile}
              onAdd={openUpload}
              onDelete={f => setDeleteTarget(f)}
            />
          ),
        },
      ]}
      right={
        /* ═══════════════════════════════════════════════════════════
             Preview                                                   */
        <TabPanel tabs={[{
          label: 'Preview',
          content: (
            <>
              {!selected && <EmptyState message="Select a file to preview" />}
              {selected && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                    <IonButton size="small" color="success" onClick={handleDownload} disabled={!previewBlob}>
                      Download
                    </IonButton>
                    {loading && <IonSpinner name="dots" />}
                  </div>
                  {error && (
                    <pre style={{
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12,
                      background: 'var(--ion-color-light)', color: 'var(--ion-color-danger)',
                      padding: '8px 12px', borderRadius: 8,
                    }}>{error}</pre>
                  )}
                  <PdfViewer blob={previewBlob} title={selected.filename} emptyMessage={loading ? 'Loading…' : 'No preview'} />
                </>
              )}
            </>
          ),
        }]} />
      }
    >
      {/* ═══════════════════════════════════════════════════════════
           Modals                                                    */}
      <ModalShell isOpen={uploadOpen} onDismiss={() => setUploadOpen(false)} title="Upload File">
        {uploadError && <IonItem lines="none"><IonText color="danger">{uploadError}</IonText></IonItem>}
        <IonItem lines="full">
          <IonInput label="Description" labelPlacement="stacked" placeholder="optional"
            value={uploadDesc} onIonInput={e => setUploadDesc(e.detail.value ?? '')} />
        </IonItem>
        <IonItem lines="full">
          <IonLabel position="stacked">File</IonLabel>
          <input type="file" style={{ marginTop: 8, marginBottom: 8 }} onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
        </IonItem>
        <IonButton expand="block" disabled={!uploadFile || uploading} onClick={handleUpload}>
          {uploading ? 'Uploading…' : 'Upload'}
        </IonButton>
      </ModalShell>

      <ModalShell isOpen={!!deleteTarget} onDismiss={() => setDeleteTarget(null)} title="Delete file">
        <IonItem lines="none">
          <IonLabel style={{ whiteSpace: 'normal' }}>
            Permanently delete <strong>{deleteTarget?.filename}</strong>? It is removed from storage and
            detached from every application it is attached to. This cannot be undone.
          </IonLabel>
        </IonItem>
        <IonButton expand="block" color="danger" disabled={deleting} onClick={confirmDelete}>
          {deleting ? 'Deleting…' : 'Delete permanently'}
        </IonButton>
      </ModalShell>
    </SplitPageLayout>
  );
};

export default Artifacts;
