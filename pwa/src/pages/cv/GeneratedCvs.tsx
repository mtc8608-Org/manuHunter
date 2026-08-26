// Page: GeneratedCvs — the user's compiled CV PDFs (cv_artifacts).
// Reads/writes: cv_artifacts via GraphQL (list) + REST download/delete (MinIO).
// Authenticated (PrivateRoute); each user sees only their own, admin sees all.

import React, { useState } from 'react';
import { IonButton, IonItem, IonLabel, IonSpinner } from '@ionic/react';
import { documentTextOutline } from 'ionicons/icons';
import ApiService, { CvArtifact } from '../../services/Api';
import SplitPageLayout from '../../components/shell/SplitPageLayout';
import TabPanel from '../../components/shell/TabPanel';
import ResourcePanel from '../../components/shell/ResourcePanel';
import ModalShell from '../../components/shell/ModalShell';
import EmptyState from '../../components/shell/EmptyState';
import PdfViewer from '../../components/shell/PdfViewer';
import { downloadBlob } from '../../utils/download';
import { AREA_NAV, PANEL_CONFIG } from '../../constants';


const GeneratedCvs: React.FC = () => {


/*
   ██████  ██████████    ████    ██████████  ████████
 ██            ██      ██    ██      ██      ██
   ████        ██      ████████      ██      ██████
       ██      ██      ██    ██      ██      ██
 ██████        ██      ██    ██      ██      ████████
                                                       */


  const [artifactVersion, setArtifactVersion] = useState(0);
  const [selected, setSelected]     = useState<CvArtifact | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<CvArtifact | null>(null);
  const [deleting, setDeleting]     = useState(false);


/*
 ██          ████      ████    ██████
 ██        ██    ██  ██    ██  ██    ██
 ██        ██    ██  ████████  ██    ██
 ██        ██    ██  ██    ██  ██    ██
 ████████    ████    ██    ██  ██████
                                         */


  const selectArtifact = async (a: CvArtifact) => {
    setSelected(a); setError(''); setPreviewBlob(null); setLoading(true);
    try {
      setPreviewBlob(await ApiService.fetchCvArtifactBlob(a.id));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load PDF');
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await ApiService.deleteCvArtifact(deleteTarget.id);
      if (selected?.id === deleteTarget.id) { setSelected(null); setPreviewBlob(null); }
      setDeleteTarget(null);
      setArtifactVersion(v => v + 1);
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
      navItems={AREA_NAV.CV_BUILDER}
      title="CV Builder"
      rightHeader={
        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ion-color-medium)' }}>
          <strong style={{ color: 'var(--ion-text-color)' }}>Generated CVs</strong>
          {' — '}preview and download the PDFs you have compiled and saved.
        </div>
      }
      leftTabs={[
        {
          label: 'Generated',
          content: (
            /* ═══════════════════════════════════════════════════════════
                 Asset list                                                */
            <ResourcePanel
              fetcher={ApiService.getCvArtifacts}
              refreshToken={artifactVersion}
              config={PANEL_CONFIG.CV_ARTIFACTS}
              selectedId={selected?.id}
              getLabel={(a: CvArtifact) => a.label || a.filename}
              getSubLabel={(a: CvArtifact) => new Date(a.created_at).toLocaleString()}
              getIcon={() => documentTextOutline}
              onSelect={(a: CvArtifact) => selectArtifact(a)}
              onDelete={(a: CvArtifact) => setDeleteTarget(a)}
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
              {!selected && <EmptyState message="Select a generated CV to preview" />}
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
                  <PdfViewer blob={previewBlob} title="Generated CV" emptyMessage={loading ? 'Loading…' : 'No preview'} />
                </>
              )}
            </>
          ),
        }]} />
      }
    >
      {/* ═══════════════════════════════════════════════════════════
           Modals                                                    */}
      <ModalShell isOpen={!!deleteTarget} onDismiss={() => setDeleteTarget(null)} title="Delete generated CV">
        <IonItem lines="none">
          <IonLabel style={{ whiteSpace: 'normal' }}>
            This permanently deletes <strong>{deleteTarget?.filename}</strong> and removes it from every
            application it is attached to. This cannot be undone.
          </IonLabel>
        </IonItem>
        <IonButton expand="block" color="danger" disabled={deleting} onClick={confirmDelete}>
          {deleting ? 'Deleting…' : 'Delete permanently'}
        </IonButton>
      </ModalShell>
    </SplitPageLayout>
  );
};

export default GeneratedCvs;
