// Page: CvTemplates — the LaTeX CV template editor (cvTemplate nodes).
// Reads/writes: cv_components (type cvTemplate) via GraphQL, owner-scoped.
// Authenticated (PrivateRoute); users edit their own, the shared default is
// read-only to non-admins (clone it with "New template").

import React, { useEffect, useState } from 'react';
import { IonButton, IonItem, IonText, IonLabel, IonInput } from '@ionic/react';
import { layersOutline } from 'ionicons/icons';
import ApiService from '../../services/Api';
import { ComponentResults } from '../../interfaces/types';
import SplitPageLayout from '../../components/shell/SplitPageLayout';
import TabPanel from '../../components/shell/TabPanel';
import ResourcePanel from '../../components/shell/ResourcePanel';
import ModalShell from '../../components/shell/ModalShell';
import EmptyState from '../../components/shell/EmptyState';
import FormRenderer from '../../components/forms/FormRenderer';
import { useAuth } from '../../contexts/AuthContext';
import { CV_TYPE, CV_FORM, CV_DEFAULT_TEMPLATE_ID, AREA_NAV, PANEL_CONFIG } from '../../constants';


/*
 ██    ██  ████████  ██        ██████    ████████  ██████      ██████
 ██    ██  ██        ██        ██    ██  ██        ██    ██  ██
 ████████  ██████    ██        ██████    ██████    ██████      ████
 ██    ██  ██        ██        ██        ██        ██    ██        ██
 ██    ██  ████████  ████████  ██        ████████  ██    ██  ██████
                                                                       */


const tplLabel = (t: ComponentResults): string => t.data?.name || t.name;


const CvTemplates: React.FC = () => {

  const { user, isAdmin } = useAuth();


/*
   ██████  ██████████    ████    ██████████  ████████
 ██            ██      ██    ██      ██      ██
   ████        ██      ████████      ██      ██████
       ██      ██      ██    ██      ██      ██
 ██████        ██      ██    ██      ██      ████████
                                                       */


  const [version, setVersion]         = useState(0);
  const [selected, setSelected]       = useState<ComponentResults | null>(null);
  const [templateForm, setTemplateForm] = useState<ComponentResults | null>(null);
  const [saveMsg, setSaveMsg]         = useState('');

  // New template modal
  const [newOpen, setNewOpen]         = useState(false);
  const [newName, setNewName]         = useState('');
  const [newSaving, setNewSaving]     = useState(false);
  const [newError, setNewError]       = useState('');

  // Delete confirm
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleting, setDeleting]       = useState(false);

  // A node is editable by its owner or an admin; the shared default may never be
  // deleted (every CV can reference it).
  const canEdit   = (t: ComponentResults) => isAdmin || (!!t.owner_id && t.owner_id === user?.id);
  const canDelete = (t: ComponentResults) => canEdit(t) && t.id !== CV_DEFAULT_TEMPLATE_ID;


/*
 ██          ████      ████    ██████
 ██        ██    ██  ██    ██  ██    ██
 ██        ██    ██  ████████  ██    ██
 ██        ██    ██  ██    ██  ██    ██
 ████████    ████    ██    ██  ██████
                                         */


  useEffect(() => {
    ApiService.getComponentByName(CV_FORM.TEMPLATE).then(f => setTemplateForm((f ?? null) as ComponentResults | null));
  }, []);

  const listFetcher = async (): Promise<(ComponentResults & { id: string })[]> => {
    const list = await ApiService.getCvComponentList(CV_TYPE.TEMPLATE);
    return list.filter((t): t is ComponentResults & { id: string } => !!t.id);
  };


/*
 ██    ██    ████    ██      ██  ██████    ██        ████████  ██████      ██████
 ██    ██  ██    ██  ████    ██  ██    ██  ██        ██        ██    ██  ██
 ████████  ████████  ██  ██  ██  ██    ██  ██        ██████    ██████      ████
 ██    ██  ██    ██  ██    ████  ██    ██  ██        ██        ██    ██        ██
 ██    ██  ██    ██  ██      ██  ██████    ████████  ████████  ██    ██  ██████
                                                                                   */


  const handleSave = async (values: any) => {
    if (!selected?.id) return;
    setSaveMsg('');
    await ApiService.updateCvComponent(selected.id, selected.name, CV_TYPE.TEMPLATE, values, selected.options);
    setSelected({ ...selected, data: values });
    setVersion(v => v + 1);
    setSaveMsg('Template saved.');
  };

  // New template clones the shared default so users start from working LaTeX.
  const openNew = () => { setNewError(''); setNewName(''); setNewOpen(true); };
  const handleCreate = async () => {
    if (!newName.trim()) { setNewError('Give the template a name'); return; }
    setNewSaving(true); setNewError('');
    try {
      const def = await ApiService.getCvComponent(CV_DEFAULT_TEMPLATE_ID);
      const cloned = { ...(def?.data ?? {}) };
      delete cloned.name;                       // the clone gets its own name
      const data     = { ...cloned, name: newName.trim() };
      const nodeName = `cv_template_${Date.now()}`;
      const result   = await ApiService.createCvComponent(nodeName, CV_TYPE.TEMPLATE, data, {}, null);
      const newId    = result?.data?.createCvComponent?.id;
      setNewOpen(false);
      setVersion(v => v + 1);
      if (newId) setSelected({ id: newId, name: nodeName, type: CV_TYPE.TEMPLATE, data, options: {}, owner_id: user?.id } as ComponentResults);
    } catch (e: any) {
      setNewError(e.message ?? 'Failed to create template');
    } finally {
      setNewSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected?.id) return;
    setDeleting(true);
    try {
      await ApiService.deleteCvComponent(selected.id);
      setDeleteOpen(false);
      setSelected(null);
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


  const editable = selected ? canEdit(selected) : false;

  return (
    <SplitPageLayout
      navItems={AREA_NAV.CV_BUILDER}
      title="CV Builder"
      rightHeader={
        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ion-color-medium)' }}>
          <strong style={{ color: 'var(--ion-text-color)' }}>Templates</strong>
          {' — '}the LaTeX boilerplate (preamble, macros, header) every CV renders through.
          Clone the shared default and tailor your own.
        </div>
      }
      leftTabs={[
        {
          label: 'Templates',
          content: (
            /* ═══════════════════════════════════════════════════════════
                 Component list                                            */
            <ResourcePanel
              fetcher={listFetcher}
              refreshToken={version}
              config={PANEL_CONFIG.CV_TEMPLATES}
              selectedId={selected?.id}
              getLabel={tplLabel}
              getSubLabel={t => t.id === CV_DEFAULT_TEMPLATE_ID ? 'Shared default' : (canEdit(t) ? 'Yours' : 'Shared')}
              getIcon={() => layersOutline}
              onSelect={t => { setSaveMsg(''); setSelected(t); }}
              onAdd={openNew}
            />
          ),
        },
      ]}
      right={
        /* ═══════════════════════════════════════════════════════════
             Edit form                                                 */
        <TabPanel tabs={[{
          label: 'Editor',
          content: (
            <>
              {!selected && <EmptyState message="Select or create a template to edit" />}
              {selected && templateForm && (
                <>
                  {!editable && (
                    <IonItem lines="none">
                      <IonLabel style={{ whiteSpace: 'normal', fontSize: 13, color: 'var(--ion-color-medium)' }}>
                        This is the shared default — read-only. Use <strong>New template</strong> to clone and edit your own.
                      </IonLabel>
                    </IonItem>
                  )}
                  {saveMsg && <IonItem lines="none"><IonText color="success" style={{ fontSize: 13 }}>{saveMsg}</IonText></IonItem>}
                  <FormRenderer
                    key={selected.id}
                    component={templateForm}
                    defaultValues={selected.data ?? {}}
                    onSubmit={editable ? handleSave : undefined}
                    submitLabel="Save Template"
                  />
                  {selected && canDelete(selected) && (
                    <IonButton expand="block" fill="outline" color="danger" onClick={() => setDeleteOpen(true)}>
                      Delete template
                    </IonButton>
                  )}
                </>
              )}
            </>
          ),
        }]} />
      }
    >
      {/* ═══════════════════════════════════════════════════════════
           Modals                                                    */}
      <ModalShell isOpen={newOpen} onDismiss={() => setNewOpen(false)} title="New Template">
        {newError && <IonItem lines="none"><IonText color="danger">{newError}</IonText></IonItem>}
        <IonItem lines="full">
          <IonInput
            label="Template name" labelPlacement="stacked"
            placeholder="e.g. Two-column modern"
            value={newName}
            onIonInput={e => setNewName(e.detail.value ?? '')}
          />
        </IonItem>
        <IonButton expand="block" disabled={newSaving} onClick={handleCreate}>
          {newSaving ? 'Cloning default…' : 'Create from default'}
        </IonButton>
      </ModalShell>

      <ModalShell isOpen={deleteOpen} onDismiss={() => setDeleteOpen(false)} title="Delete template">
        <IonItem lines="none">
          <IonLabel style={{ whiteSpace: 'normal' }}>
            Delete <strong>{selected ? tplLabel(selected) : ''}</strong>? CVs using it will need a
            different template selected before they compile. This cannot be undone.
          </IonLabel>
        </IonItem>
        <IonButton expand="block" color="danger" disabled={deleting} onClick={handleDelete}>
          {deleting ? 'Deleting…' : 'Delete permanently'}
        </IonButton>
      </ModalShell>
    </SplitPageLayout>
  );
};

export default CvTemplates;
