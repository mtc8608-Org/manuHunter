// Page: Applications — the job-search tracker.
// Left: every application, filterable by text and status.
// Right: the selected application's details, the pasted job description, attached
//        artifacts (CV / cover / JD) with download, and a response/status timeline.
// Reads/writes: applications / application_events (GraphQL) and the framework
//               files table + MinIO (REST) for artifacts.

import React, { useState } from 'react';
import {
  IonButton, IonSpinner, IonItem, IonLabel, IonInput, IonTextarea,
  IonSelect, IonSelectOption, IonIcon, IonText, IonBadge, IonNote,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
} from '@ionic/react';
import {
  briefcaseOutline, documentTextOutline, downloadOutline,
  trashOutline, addOutline, openOutline, timeOutline,
} from 'ionicons/icons';
import { Application, ApplicationFile } from '../../interfaces/types';
import ApiService from '../../services/Api';
import SplitPageLayout from '../../components/shell/SplitPageLayout';
import TabPanel from '../../components/shell/TabPanel';
import EmptyState from '../../components/shell/EmptyState';
import ModalShell from '../../components/shell/ModalShell';
import ResourcePanel from '../../components/shell/ResourcePanel';
import { useAuth } from '../../contexts/AuthContext';
import {
  API_BASE, ENDPOINT, AREA_NAV, PANEL_CONFIG,
  APP_STATUS, APP_STATUS_COLOR, APP_FILE_KINDS,
} from '../../constants';

const formatDate = (val: string | null) => {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString();
};

const statusColor = (s: string) => APP_STATUS_COLOR[s] ?? 'medium';

const EVENT_TYPES = [
  { value: 'response',      label: 'Response received' },
  { value: 'interview',     label: 'Interview' },
  { value: 'status_change', label: 'Status change' },
  { value: 'note',          label: 'Note' },
];

// Empty form used for the "New application" modal.
const blankForm: Partial<Application> = {
  company: '', role: '', location: '', source: '', job_url: '',
  status: 'draft', salary: '', contact: '', applied_at: '',
  job_description: '', notes: '',
};

const Applications: React.FC = () => {
  const { logout } = useAuth();

  const [listVersion, setListVersion] = useState(0);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected]       = useState<Application | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // create / edit modal
  const [editorOpen, setEditorOpen]   = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [form, setForm]               = useState<Partial<Application>>(blankForm);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');

  // upload modal
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [uploadFile, setUploadFile]   = useState<File | null>(null);
  const [uploadKind, setUploadKind]   = useState('cv');
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState('');

  // add-event modal
  const [eventOpen, setEventOpen]     = useState(false);
  const [eventType, setEventType]     = useState('response');
  const [eventDetail, setEventDetail] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);

  const refreshList = () => setListVersion(v => v + 1);

  const loadDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const full = await ApiService.getApplication(id);
      setSelected(full);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSelect = (app: Application) => { loadDetail(app.id); };

  // ── create / edit ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(blankForm);
    setSaveError('');
    setEditorOpen(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setEditingId(selected.id);
    setForm({
      company: selected.company, role: selected.role, location: selected.location ?? '',
      source: selected.source ?? '', job_url: selected.job_url ?? '', status: selected.status,
      salary: selected.salary ?? '', contact: selected.contact ?? '',
      applied_at: selected.applied_at ?? '', job_description: selected.job_description ?? '',
      notes: selected.notes ?? '',
    });
    setSaveError('');
    setEditorOpen(true);
  };

  const setField = (k: keyof Application, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.company || !form.role) { setSaveError('Company and role are required.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const payload = { ...form, applied_at: form.applied_at || undefined };
      const saved = editingId
        ? await ApiService.updateApplication(editingId, payload)
        : await ApiService.createApplication(payload);
      setEditorOpen(false);
      refreshList();
      if (saved) await loadDetail(saved.id);
    } catch (e: any) {
      if (e?.status === 401) { logout(); return; }
      setSaveError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete application to ${selected.company}?`)) return;
    await ApiService.deleteApplication(selected.id);
    setSelected(null);
    refreshList();
  };

  // Quick status change from the detail header (also logs a timeline event).
  const handleStatusChange = async (status: string) => {
    if (!selected || status === selected.status) return;
    await ApiService.updateApplication(selected.id, { status });
    await ApiService.addApplicationEvent(selected.id, 'status_change', `→ ${status}`);
    refreshList();
    await loadDetail(selected.id);
  };

  // ── artifacts ──────────────────────────────────────────────────────────────
  const downloadArtifact = async (file: ApplicationFile) => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API_BASE}${ENDPOINT.FILES}/${file.id}/download`, { headers });
    if (!res.ok) return;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const openUpload = () => { setUploadFile(null); setUploadKind('cv'); setUploadError(''); setUploadOpen(true); };

  const handleUpload = async () => {
    if (!selected || !uploadFile) return;
    setUploading(true); setUploadError('');
    try {
      await ApiService.uploadApplicationFile(selected.id, uploadFile, uploadKind);
      setUploadOpen(false);
      await loadDetail(selected.id);
    } catch (e: any) {
      if (e?.status === 401) { logout(); return; }
      setUploadError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUnlinkFile = async (file: ApplicationFile) => {
    if (!selected) return;
    await ApiService.unlinkApplicationFile(selected.id, file.id);
    await loadDetail(selected.id);
  };

  // ── events ─────────────────────────────────────────────────────────────────
  const openEvent = () => { setEventType('response'); setEventDetail(''); setEventOpen(true); };

  const handleAddEvent = async () => {
    if (!selected) return;
    setSavingEvent(true);
    try {
      await ApiService.addApplicationEvent(selected.id, eventType, eventDetail || undefined);
      setEventOpen(false);
      await loadDetail(selected.id);
    } finally {
      setSavingEvent(false);
    }
  };

  return (
    <SplitPageLayout
      navItems={AREA_NAV.APPLICATIONS}
      title="Applications"
      leftTabs={[{
        label: 'Applications',
        content: (
          <ResourcePanel<Application>
            fetcher={() => ApiService.getApplications()}
            refreshToken={listVersion}
            config={PANEL_CONFIG.APPLICATIONS_LIST}
            selectedId={selected?.id}
            getLabel={a => a.role}
            getSubLabel={a => [a.company, a.location].filter(Boolean).join(' · ') || a.company}
            getIcon={() => briefcaseOutline}
            getBadge={a => ({ label: a.status, color: statusColor(a.status) })}
            onSelect={handleSelect}
            onAdd={openCreate}
            filterFn={(a, text, type) => {
              const t = text.toLowerCase();
              const matchesText = !t || a.company.toLowerCase().includes(t) || a.role.toLowerCase().includes(t);
              const matchesType = !type || a.status === type;
              return matchesText && matchesType;
            }}
            filter={{
              text: search, onTextChange: setSearch,
              typeValue: statusFilter, onTypeChange: setStatusFilter,
            }}
          />
        ),
      }]}
      right={
        <TabPanel tabs={[{
          label: 'Detail',
          content: loadingDetail ? (
            <div style={{ textAlign: 'center', padding: 24 }}><IonSpinner /></div>
          ) : !selected ? (
            <EmptyState message="Select an application to view details" />
          ) : (
          <>
            {/* Overview */}
            <IonCard>
              <IonCardHeader>
                <IonItem lines="none">
                  <IonCardTitle slot="start">{selected.role}</IonCardTitle>
                  <IonButton slot="end" fill="outline" size="small" onClick={openEdit}>Edit</IonButton>
                  <IonButton slot="end" color="danger" fill="outline" size="small" onClick={handleDelete}>
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonButton>
                </IonItem>
              </IonCardHeader>
              <IonCardContent>
                <IonItem lines="full">
                  <IonSelect
                    label="Status" labelPlacement="stacked" interface="popover"
                    value={selected.status} onIonChange={e => handleStatusChange(e.detail.value)}
                  >
                    {APP_STATUS.map(s => (
                      <IonSelectOption key={s} value={s}>{s}</IonSelectOption>
                    ))}
                  </IonSelect>
                  <IonBadge slot="end" color={statusColor(selected.status)}>{selected.status}</IonBadge>
                </IonItem>
                {[
                  { label: 'Company',  value: selected.company },
                  { label: 'Location', value: selected.location ?? '—' },
                  { label: 'Source',   value: selected.source ?? '—' },
                  { label: 'Salary',   value: selected.salary ?? '—' },
                  { label: 'Contact',  value: selected.contact ?? '—' },
                  { label: 'Applied',  value: formatDate(selected.applied_at) },
                ].map(row => (
                  <IonItem key={row.label} lines="full">
                    <IonLabel>
                      <p style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>{row.label}</p>
                      <p>{row.value}</p>
                    </IonLabel>
                  </IonItem>
                ))}
                {selected.job_url && (
                  <IonItem lines="full" href={selected.job_url} target="_blank" rel="noreferrer">
                    <IonIcon slot="start" icon={openOutline} />
                    <IonLabel>Open job posting</IonLabel>
                  </IonItem>
                )}
                {selected.notes && (
                  <IonItem lines="none">
                    <IonLabel className="ion-text-wrap">
                      <p style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>Notes</p>
                      <p>{selected.notes}</p>
                    </IonLabel>
                  </IonItem>
                )}
              </IonCardContent>
            </IonCard>

            {/* Artifacts */}
            <IonCard style={{ marginTop: 12 }}>
              <IonCardHeader>
                <IonItem lines="none">
                  <IonCardTitle slot="start">Artifacts</IonCardTitle>
                  <IonButton slot="end" size="small" color="success" onClick={openUpload}>
                    <IonIcon slot="start" icon={addOutline} />Attach
                  </IonButton>
                </IonItem>
              </IonCardHeader>
              <IonCardContent>
                {!selected.files?.length ? (
                  <IonNote>No CV or documents attached yet.</IonNote>
                ) : selected.files.map(f => (
                  <IonItem key={f.id} lines="full">
                    <IonIcon slot="start" icon={documentTextOutline} />
                    <IonLabel className="ion-text-wrap">
                      <p>{f.filename}</p>
                      <p style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>{f.kind}</p>
                    </IonLabel>
                    <IonButton slot="end" fill="clear" size="small" onClick={() => downloadArtifact(f)}>
                      <IonIcon slot="icon-only" icon={downloadOutline} />
                    </IonButton>
                    <IonButton slot="end" fill="clear" color="danger" size="small" onClick={() => handleUnlinkFile(f)}>
                      <IonIcon slot="icon-only" icon={trashOutline} />
                    </IonButton>
                  </IonItem>
                ))}
              </IonCardContent>
            </IonCard>

            {/* Timeline */}
            <IonCard style={{ marginTop: 12 }}>
              <IonCardHeader>
                <IonItem lines="none">
                  <IonCardTitle slot="start">Timeline</IonCardTitle>
                  <IonButton slot="end" size="small" fill="outline" onClick={openEvent}>
                    <IonIcon slot="start" icon={addOutline} />Log
                  </IonButton>
                </IonItem>
              </IonCardHeader>
              <IonCardContent>
                {!selected.events?.length ? (
                  <IonNote>No events logged.</IonNote>
                ) : selected.events.map(ev => (
                  <IonItem key={ev.id} lines="full">
                    <IonIcon slot="start" icon={timeOutline} />
                    <IonLabel className="ion-text-wrap">
                      <p>{ev.event_type}{ev.detail ? `: ${ev.detail}` : ''}</p>
                      <p style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>{formatDate(ev.occurred_at)}</p>
                    </IonLabel>
                  </IonItem>
                ))}
              </IonCardContent>
            </IonCard>

            {/* Job description */}
            <IonCard style={{ marginTop: 12 }}>
              <IonCardHeader><IonCardTitle>Job Description</IonCardTitle></IonCardHeader>
              <IonCardContent>
                {selected.job_description ? (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                    {selected.job_description}
                  </pre>
                ) : <IonNote>No description saved.</IonNote>}
              </IonCardContent>
            </IonCard>
          </>
          ),
        }]} />
      }
    >
      {/* ── Create / Edit modal ── */}
      <ModalShell
        isOpen={editorOpen}
        onDismiss={() => setEditorOpen(false)}
        title={editingId ? 'Edit Application' : 'New Application'}
        dismissLabel="Close"
      >
        <div style={{ padding: 16 }}>
          {saveError && <IonText color="danger"><p>{saveError}</p></IonText>}
          <IonItem lines="full">
            <IonInput label="Company *" labelPlacement="stacked" value={form.company}
              onIonInput={e => setField('company', e.detail.value ?? '')} />
          </IonItem>
          <IonItem lines="full">
            <IonInput label="Role *" labelPlacement="stacked" value={form.role}
              onIonInput={e => setField('role', e.detail.value ?? '')} />
          </IonItem>
          <IonItem lines="full">
            <IonInput label="Location" labelPlacement="stacked" value={form.location}
              onIonInput={e => setField('location', e.detail.value ?? '')} />
          </IonItem>
          <IonItem lines="full">
            <IonInput label="Source" labelPlacement="stacked" value={form.source} placeholder="LinkedIn, referral…"
              onIonInput={e => setField('source', e.detail.value ?? '')} />
          </IonItem>
          <IonItem lines="full">
            <IonInput label="Job URL" labelPlacement="stacked" value={form.job_url}
              onIonInput={e => setField('job_url', e.detail.value ?? '')} />
          </IonItem>
          <IonItem lines="full">
            <IonSelect label="Status" labelPlacement="stacked" interface="popover" value={form.status}
              onIonChange={e => setField('status', e.detail.value)}>
              {APP_STATUS.map(s => <IonSelectOption key={s} value={s}>{s}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <IonItem lines="full">
            <IonInput label="Salary" labelPlacement="stacked" value={form.salary}
              onIonInput={e => setField('salary', e.detail.value ?? '')} />
          </IonItem>
          <IonItem lines="full">
            <IonInput label="Contact" labelPlacement="stacked" value={form.contact}
              onIonInput={e => setField('contact', e.detail.value ?? '')} />
          </IonItem>
          <IonItem lines="full">
            <IonLabel position="stacked" style={{ fontSize: 12 }}>Applied date</IonLabel>
            <input type="date" style={{ marginTop: 8, marginBottom: 8, background: 'transparent', color: 'var(--ion-text-color)', border: 'none' }}
              value={form.applied_at ?? ''} onChange={e => setField('applied_at', e.target.value)} />
          </IonItem>
          <IonItem lines="full">
            <IonTextarea label="Job description" labelPlacement="stacked" autoGrow value={form.job_description}
              onIonInput={e => setField('job_description', e.detail.value ?? '')} />
          </IonItem>
          <IonItem lines="full">
            <IonTextarea label="Notes" labelPlacement="stacked" autoGrow value={form.notes}
              onIonInput={e => setField('notes', e.detail.value ?? '')} />
          </IonItem>
          <IonButton expand="block" style={{ marginTop: 16 }} disabled={saving} onClick={handleSave}>
            {saving ? <IonSpinner name="dots" /> : editingId ? 'Save Changes' : 'Create Application'}
          </IonButton>
        </div>
      </ModalShell>

      {/* ── Upload artifact modal ── */}
      <ModalShell isOpen={uploadOpen} onDismiss={() => setUploadOpen(false)} title="Attach Artifact" dismissLabel="Close">
        <div style={{ padding: 16 }}>
          {uploadError && <IonText color="danger"><p>{uploadError}</p></IonText>}
          <IonItem lines="full">
            <IonSelect label="Kind" labelPlacement="stacked" interface="popover" value={uploadKind}
              onIonChange={e => setUploadKind(e.detail.value)}>
              {APP_FILE_KINDS.map(k => <IonSelectOption key={k.value} value={k.value}>{k.label}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <IonItem lines="full">
            <IonLabel position="stacked">File</IonLabel>
            <input type="file" style={{ marginTop: 8, marginBottom: 8 }}
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
          </IonItem>
          <IonButton expand="block" style={{ marginTop: 16 }} disabled={!uploadFile || uploading} onClick={handleUpload}>
            {uploading ? <IonSpinner name="dots" /> : 'Upload'}
          </IonButton>
        </div>
      </ModalShell>

      {/* ── Log event modal ── */}
      <ModalShell isOpen={eventOpen} onDismiss={() => setEventOpen(false)} title="Log Event" dismissLabel="Close">
        <div style={{ padding: 16 }}>
          <IonItem lines="full">
            <IonSelect label="Type" labelPlacement="stacked" interface="popover" value={eventType}
              onIonChange={e => setEventType(e.detail.value)}>
              {EVENT_TYPES.map(t => <IonSelectOption key={t.value} value={t.value}>{t.label}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <IonItem lines="full">
            <IonTextarea label="Detail" labelPlacement="stacked" autoGrow value={eventDetail}
              onIonInput={e => setEventDetail(e.detail.value ?? '')} />
          </IonItem>
          <IonButton expand="block" style={{ marginTop: 16 }} disabled={savingEvent} onClick={handleAddEvent}>
            {savingEvent ? <IonSpinner name="dots" /> : 'Log Event'}
          </IonButton>
        </div>
      </ModalShell>
    </SplitPageLayout>
  );
};

export default Applications;
