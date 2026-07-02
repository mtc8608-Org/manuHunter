// Page: Applications — the job-application tracker (jobs domain).
// Reads/writes: applications / application_events (GraphQL) + the framework files
//               table + MinIO (REST) for artifacts. Owner-scoped; admin sees all.

import React, { useEffect, useState } from 'react';
import {
  IonButton, IonSpinner, IonItem, IonLabel, IonText,
  IonSelect, IonSelectOption, IonIcon, IonBadge, IonNote,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
} from '@ionic/react';
import {
  briefcaseOutline, documentTextOutline, timeOutline, openOutline,
} from 'ionicons/icons';
import { Application, ApplicationFile, ApplicationEvent, FileRecord, ComponentResults } from '../../interfaces/types';
import ApiService from '../../services/Api';
import SplitPageLayout from '../../components/shell/SplitPageLayout';
import TabPanel from '../../components/shell/TabPanel';
import EmptyState from '../../components/shell/EmptyState';
import ModalShell from '../../components/shell/ModalShell';
import ResourcePanel from '../../components/shell/ResourcePanel';
import DataTable from '../../components/shell/DataTable';
import FormRenderer from '../../components/forms/FormRenderer';
import { useAuth } from '../../contexts/AuthContext';
import {
  AREA_NAV, PANEL_CONFIG, APP_STATUS, APP_STATUS_COLOR, APP_FILE_KINDS, APP_FORM,
} from '../../constants';


/*
 ██    ██  ████████  ██        ██████    ████████  ██████      ██████
 ██    ██  ██        ██        ██    ██  ██        ██    ██  ██
 ████████  ██████    ██        ██████    ██████    ██████      ████
 ██    ██  ██        ██        ██        ██        ██    ██        ██
 ██    ██  ████████  ████████  ██        ████████  ██    ██  ██████
                                                                       */


const formatDate = (val: string | null) => {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString();
};

const statusColor = (s: string) => APP_STATUS_COLOR[s] ?? 'medium';
const fileMeta = (f: FileRecord) =>
  [f.size ? `${Math.max(1, Math.round(f.size / 1024))} KB` : null, formatDate(f.created_at)].filter(Boolean).join(' · ');

// Table view (DataTable) — flat columns + pretty headers.
const appFlatten = (a: Application): Record<string, string> => ({
  company:  a.company ?? '',
  role:     a.role ?? '',
  status:   a.status ?? '',
  location: a.location ?? '',
  source:   a.source ?? '',
  salary:   a.salary ?? '',
  contact:  a.contact ?? '',
});
const APP_TABLE_LABELS = new Map<string, string>([
  ['company', 'Company'], ['role', 'Role'], ['status', 'Status'],
  ['location', 'Location'], ['source', 'Source'], ['salary', 'Salary'], ['contact', 'Contact'],
]);


const Applications: React.FC = () => {

  const { logout } = useAuth();


/*
   ██████  ██████████    ████    ██████████  ████████
 ██            ██      ██    ██      ██      ██
   ████        ██      ████████      ██      ██████
       ██      ██      ██    ██      ██      ██
 ██████        ██      ██    ██      ██      ████████
                                                       */


  const [listVersion, setListVersion]     = useState(0);
  const [detailVersion, setDetailVersion] = useState(0);
  const [tableVersion, setTableVersion]   = useState(1);   // >0 → DataTable auto-loads
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [selected, setSelected]           = useState<Application | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Seeded FormRenderer forms
  const [appForm, setAppForm]     = useState<ComponentResults | null>(null);
  const [eventForm, setEventForm] = useState<ComponentResults | null>(null);

  // Application editor modal — editTarget is the row being edited (null = create).
  const [editorOpen, setEditorOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Application | null>(null);
  const [editorError, setEditorError] = useState('');

  // Log-event modal
  const [eventOpen, setEventOpen] = useState(false);

  // Attach-existing-file modal (pick from the user's files → link)
  const [attachOpen, setAttachOpen]   = useState(false);
  const [attachPick, setAttachPick]   = useState<string | null>(null);
  const [attachKind, setAttachKind]   = useState('cv');
  const [attaching, setAttaching]     = useState(false);

  // Delete-application confirm
  const [deleteAppOpen, setDeleteAppOpen] = useState(false);
  const [deletingApp, setDeletingApp]     = useState(false);


/*
 ██          ████      ████    ██████
 ██        ██    ██  ██    ██  ██    ██
 ██        ██    ██  ████████  ██    ██
 ██        ██    ██  ██    ██  ██    ██
 ████████    ████    ██    ██  ██████
                                         */


  useEffect(() => {
    ApiService.getComponentByName(APP_FORM.APPLICATION).then(f => setAppForm((f ?? null) as ComponentResults | null));
    ApiService.getComponentByName(APP_FORM.EVENT).then(f => setEventForm((f ?? null) as ComponentResults | null));
  }, []);

  const loadDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const full = await ApiService.getApplication(id);
      setSelected(full);
      setDetailVersion(v => v + 1);
    } finally {
      setLoadingDetail(false);
    }
  };

  const appFetcher      = () => ApiService.getApplications();
  const filesFetcher    = () => ApiService.getFiles();
  const attachedFetcher = async (): Promise<ApplicationFile[]> => selected?.files ?? [];
  const eventsFetcher   = async (): Promise<ApplicationEvent[]> => selected?.events ?? [];


/*
 ██    ██    ████    ██      ██  ██████    ██        ████████  ██████      ██████
 ██    ██  ██    ██  ████    ██  ██    ██  ██        ██        ██    ██  ██
 ████████  ████████  ██  ██  ██  ██    ██  ██        ██████    ██████      ████
 ██    ██  ██    ██  ██    ████  ██    ██  ██        ██        ██    ██        ██
 ██    ██  ██    ██  ██      ██  ██████    ████████  ████████  ██    ██  ██████
                                                                                   */


  // ── Application create / edit (FormRenderer over form_application) ─────────────
  const editingId = editTarget?.id ?? null;
  const openEditor = (row: Application | null) => { setEditTarget(row); setEditorError(''); setEditorOpen(true); };
  const openCreate = () => openEditor(null);
  const openEdit   = () => { if (selected) openEditor(selected); };

  const handleSaveApplication = async (values: any) => {
    if (!values.company || !values.role) { setEditorError('Company and role are required.'); return; }
    setEditorError('');
    try {
      const payload = { ...values, applied_at: values.applied_at || undefined };
      const saved = editingId
        ? await ApiService.updateApplication(editingId, payload)
        : await ApiService.createApplication(payload);
      setEditorOpen(false);
      setListVersion(v => v + 1);
      setTableVersion(v => v + 1);
      if (saved) await loadDetail(saved.id);
    } catch (e: any) {
      if (e?.status === 401) { logout(); return; }
      setEditorError(e?.message ?? 'Save failed');
    }
  };

  // Delete straight from the table row (DataTable also drops it from its own state).
  const deleteFromTable = async (id: string) => {
    await ApiService.deleteApplication(id);
    setListVersion(v => v + 1);
    if (selected?.id === id) setSelected(null);
  };

  const confirmDeleteApp = async () => {
    if (!selected) return;
    setDeletingApp(true);
    try {
      await ApiService.deleteApplication(selected.id);
      setDeleteAppOpen(false);
      setSelected(null);
      setListVersion(v => v + 1);
    } finally {
      setDeletingApp(false);
    }
  };

  // Quick status change from the detail header (also logs a timeline event).
  const handleStatusChange = async (status: string) => {
    if (!selected || status === selected.status) return;
    await ApiService.updateApplication(selected.id, { status });
    await ApiService.addApplicationEvent(selected.id, 'status_change', `→ ${status}`);
    setListVersion(v => v + 1);
    await loadDetail(selected.id);
  };

  // ── Attached files (attach existing / unlink / download) ──────────────────────
  const download = async (id: string, filename: string) => {
    try {
      const blob = await ApiService.fetchFileBlob(id);
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { console.error('Download failed:', e); }
  };

  const openAttach = () => { setAttachPick(null); setAttachKind('cv'); setAttachOpen(true); };
  const handleAttach = async () => {
    if (!selected || !attachPick) return;
    setAttaching(true);
    try {
      await ApiService.linkApplicationFile(selected.id, attachPick, attachKind);
      setAttachOpen(false);
      await loadDetail(selected.id);
    } finally {
      setAttaching(false);
    }
  };

  const handleUnlink = async (file: ApplicationFile) => {
    if (!selected) return;
    await ApiService.unlinkApplicationFile(selected.id, file.id);
    await loadDetail(selected.id);
  };

  // ── Timeline events (FormRenderer over form_application_event) ─────────────────
  const openEvent = () => setEventOpen(true);
  const handleAddEvent = async (values: any) => {
    if (!selected) return;
    await ApiService.addApplicationEvent(selected.id, values.event_type || 'note', values.detail || undefined);
    setEventOpen(false);
    await loadDetail(selected.id);
  };


/*
 ██████    ████████  ██      ██  ██████    ████████  ██████
 ██    ██  ██        ████    ██  ██    ██  ██        ██    ██
 ██████    ██████    ██  ██  ██  ██    ██  ██████    ██████
 ██    ██  ██        ██    ████  ██    ██  ██        ██    ██
 ██    ██  ████████  ██      ██  ██████    ████████  ██    ██
                                                               */


  const editorDefaults = editTarget ?? { status: 'draft' };

  return (
    <SplitPageLayout
      navItems={AREA_NAV.APPLICATIONS}
      title="Job Applications"
      leftTabs={[
        {
          label: 'Applications',
          content: (
            /* ═══════════════════════════════════════════════════════════
                 Component list                                            */
            <ResourcePanel<Application>
              fetcher={appFetcher}
              refreshToken={listVersion}
              config={PANEL_CONFIG.APPLICATIONS_LIST}
              selectedId={selected?.id}
              getLabel={a => a.role}
              getSubLabel={a => [a.company, a.location].filter(Boolean).join(' · ') || a.company}
              getIcon={() => briefcaseOutline}
              getBadge={a => ({ label: a.status, color: statusColor(a.status) })}
              onSelect={a => loadDetail(a.id)}
              onAdd={openCreate}
              filterFn={(a, text, type) => {
                const t = text.toLowerCase();
                return (!t || a.company.toLowerCase().includes(t) || a.role.toLowerCase().includes(t))
                    && (!type || a.status === type);
              }}
              filter={{ text: search, onTextChange: setSearch, typeValue: statusFilter, onTypeChange: setStatusFilter }}
            />
          ),
        },
      ]}
      right={
        <TabPanel tabs={[
          {
          label: 'Detail',
          content: loadingDetail ? (
            <div style={{ textAlign: 'center', padding: 24 }}><IonSpinner /></div>
          ) : !selected ? (
            <EmptyState message="Select an application to view details" />
          ) : (
            <>
              {/* ═══════════════════════════════════════════════════════════
                   Overview                                                  */}
              <IonCard>
                <IonCardHeader>
                  <IonItem lines="none">
                    <IonCardTitle slot="start">{selected.role}</IonCardTitle>
                    <IonButton slot="end" fill="outline" size="small" onClick={openEdit}>Edit</IonButton>
                    <IonButton slot="end" color="danger" fill="outline" size="small" onClick={() => setDeleteAppOpen(true)}>Delete</IonButton>
                  </IonItem>
                </IonCardHeader>
                <IonCardContent>
                  <IonItem lines="full">
                    <IonSelect label="Status" labelPlacement="stacked" interface="popover"
                      value={selected.status} onIonChange={e => handleStatusChange(e.detail.value)}>
                      {APP_STATUS.map(s => <IonSelectOption key={s} value={s}>{s}</IonSelectOption>)}
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
                      <IonLabel><p style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>{row.label}</p><p>{row.value}</p></IonLabel>
                    </IonItem>
                  ))}
                  {selected.job_url && (
                    <IonItem lines="full" href={selected.job_url} target="_blank" rel="noreferrer">
                      <IonIcon slot="start" icon={openOutline} /><IonLabel>Open job posting</IonLabel>
                    </IonItem>
                  )}
                  {selected.notes && (
                    <IonItem lines="none">
                      <IonLabel className="ion-text-wrap"><p style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>Notes</p><p>{selected.notes}</p></IonLabel>
                    </IonItem>
                  )}
                </IonCardContent>
              </IonCard>

              {/* ═══════════════════════════════════════════════════════════
                   Job Description                                           */}
              <IonCard style={{ marginTop: 12 }}>
                <IonCardHeader><IonCardTitle>Job Description</IonCardTitle></IonCardHeader>
                <IonCardContent>
                  {selected.job_description
                    ? <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{selected.job_description}</pre>
                    : <IonNote>No description saved.</IonNote>}
                </IonCardContent>
              </IonCard>

              {/* ═══════════════════════════════════════════════════════════
                   Attached artifacts                                        */}
              <div style={{ marginTop: 12 }}>
                <ResourcePanel<ApplicationFile>
                  fetcher={attachedFetcher}
                  refreshToken={detailVersion}
                  config={PANEL_CONFIG.APP_FILES}
                  getLabel={f => f.filename}
                  getSubLabel={f => f.kind}
                  getIcon={() => documentTextOutline}
                  onSelect={f => download(f.id, f.filename)}
                  onAdd={openAttach}
                  onDelete={f => handleUnlink(f)}
                />
              </div>

              {/* ═══════════════════════════════════════════════════════════
                   Timeline                                                  */}
              <div style={{ marginTop: 12 }}>
                <ResourcePanel<ApplicationEvent>
                  fetcher={eventsFetcher}
                  refreshToken={detailVersion}
                  config={PANEL_CONFIG.APP_TIMELINE}
                  getLabel={ev => ev.event_type + (ev.detail ? `: ${ev.detail}` : '')}
                  getSubLabel={ev => formatDate(ev.occurred_at)}
                  getIcon={() => timeOutline}
                  onSelect={() => {}}
                  onAdd={openEvent}
                />
              </div>
            </>
          ),
          },
          {
            label: 'Table',
            content: (
              /* ═══════════════════════════════════════════════════════════
                   Table                                                     */
              <DataTable<Application>
                title="Applications"
                fetcher={() => ApiService.getApplications()}
                flattenRow={appFlatten}
                leadingCols={[{ label: 'Applied', format: a => formatDate(a.applied_at) }]}
                labelMap={APP_TABLE_LABELS}
                filterOptions={{ status: [...APP_STATUS] }}
                exportFilename="applications"
                refreshToken={tableVersion}
                onEdit={row => openEditor(row)}
                onDelete={deleteFromTable}
              />
            ),
          },
        ]} />
      }
    >
      {/* ═══════════════════════════════════════════════════════════
           Modals                                                    */}
      <ModalShell isOpen={editorOpen} onDismiss={() => setEditorOpen(false)} title={editingId ? 'Edit Application' : 'New Application'}>
        {editorError && <IonItem lines="none"><IonText color="danger">{editorError}</IonText></IonItem>}
        {appForm && (
          <FormRenderer
            key={editingId ?? 'new'}
            component={appForm}
            defaultValues={editorDefaults}
            onSubmit={handleSaveApplication}
            submitLabel={editingId ? 'Save Changes' : 'Create Application'}
          />
        )}
      </ModalShell>

      <ModalShell isOpen={eventOpen} onDismiss={() => setEventOpen(false)} title="Log Event">
        {eventForm && (
          <FormRenderer
            component={eventForm}
            defaultValues={{ event_type: 'response' }}
            onSubmit={handleAddEvent}
            submitLabel="Log Event"
          />
        )}
      </ModalShell>

      <ModalShell isOpen={attachOpen} onDismiss={() => setAttachOpen(false)} title="Attach a file">
        <IonItem lines="full">
          <IonSelect label="Attach as" labelPlacement="stacked" interface="popover" value={attachKind}
            onIonChange={e => setAttachKind(e.detail.value)}>
            {APP_FILE_KINDS.map(k => <IonSelectOption key={k.value} value={k.value}>{k.label}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
        <ResourcePanel<FileRecord>
          fetcher={filesFetcher}
          refreshToken={attachOpen ? 1 : 0}
          title="Your files"
          selectedId={attachPick}
          getLabel={f => f.filename}
          getSubLabel={fileMeta}
          getIcon={() => documentTextOutline}
          onSelect={f => setAttachPick(f.id)}
        />
        <IonButton expand="block" disabled={!attachPick || attaching} onClick={handleAttach}>
          {attaching ? 'Attaching…' : 'Attach to application'}
        </IonButton>
      </ModalShell>

      <ModalShell isOpen={deleteAppOpen} onDismiss={() => setDeleteAppOpen(false)} title="Delete application">
        <IonItem lines="none">
          <IonLabel style={{ whiteSpace: 'normal' }}>
            Delete the application to <strong>{selected?.company}</strong> ({selected?.role})? Its timeline and file links are removed. This cannot be undone.
          </IonLabel>
        </IonItem>
        <IonButton expand="block" color="danger" disabled={deletingApp} onClick={confirmDeleteApp}>
          {deletingApp ? 'Deleting…' : 'Delete permanently'}
        </IonButton>
      </ModalShell>
    </SplitPageLayout>
  );
};

export default Applications;
