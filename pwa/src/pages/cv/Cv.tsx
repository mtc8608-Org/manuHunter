// Page: Cv — the user-facing LaTeX CV builder.
// Reads/writes: cv_components / cv_components_relationships (GraphQL, owner-scoped)
//               and the compile + cv_artifacts REST routes (Python TeX Live + MinIO).
// Authenticated (PrivateRoute); each user sees only their own CVs, admin sees all.

import React, { useEffect, useRef, useState } from 'react';
import { IonButton, IonSpinner, IonItem, IonText, IonInput } from '@ionic/react';
import { documentTextOutline } from 'ionicons/icons';
import ApiService from '../../services/Api';
import { ComponentResults } from '../../interfaces/types';
import SplitPageLayout from '../../components/shell/SplitPageLayout';
import TabPanel from '../../components/shell/TabPanel';
import ResourcePanel from '../../components/shell/ResourcePanel';
import ModalShell from '../../components/shell/ModalShell';
import EmptyState from '../../components/shell/EmptyState';
import PdfViewer from '../../components/shell/PdfViewer';
import FormRenderer from '../../components/forms/FormRenderer';
import TreeEditor, { TreeEditorHandle } from '../../components/shell/TreeEditor';
import {
  CV_TYPE, CV_EDITOR_ID, CV_FORM, CV_DEFAULT_TEMPLATE_ID,
  CV_ADDABLE_TYPES, AREA_NAV, PANEL_CONFIG,
} from '../../constants';


/*
 ██    ██  ████████  ██        ██████    ████████  ██████      ██████
 ██    ██  ██        ██        ██    ██  ██        ██    ██  ██
 ████████  ██████    ██        ██████    ██████    ██████      ████
 ██    ██  ██        ██        ██        ██        ██    ██        ██
 ██    ██  ████████  ████████  ██        ████████  ██    ██  ██████
                                                                       */


const CV_BADGE: Record<string, { label: string; color: string }> = {
  [CV_TYPE.DOCUMENT]:    { label: 'CV',      color: 'primary'   },
  [CV_TYPE.SECTION]:     { label: 'Section', color: 'tertiary'  },
  [CV_TYPE.ENTRY]:       { label: 'Entry',   color: 'secondary' },
  [CV_TYPE.TEXTROW]:     { label: 'Row',     color: 'success'   },
  [CV_TYPE.PUBLICATION]: { label: 'Pub',     color: 'warning'   },
  [CV_TYPE.TEMPLATE]:    { label: 'Template', color: 'medium'   },
};

const cvBadgeLabel = (type: string) => CV_BADGE[type]?.label ?? type;
const cvBadgeColor = (type: string) => CV_BADGE[type]?.color ?? 'medium';

const truncate = (s: string, n = 80) => (s.length > n ? s.slice(0, n) + '…' : s);

// Strip LaTeX so list labels read as plain text (\& → &, drop \cmd and braces).
const cleanLatex = (s = ''): string => s
  .replace(/\\&/g, '&')
  .replace(/\\[a-zA-Z]+\*?/g, '')
  .replace(/[{}]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// Variant tag parsed from the seed name convention `cv_<type>_<topic>_<variant>`.
const VARIANT_TAG: Record<string, string> = { clinical: 'Clinical', quant: 'Quant' };
const cvVariant = (name = ''): string => VARIANT_TAG[name.match(/_(clinical|quant)$/)?.[1] ?? ''] ?? '';

// Display-label convention (list/picker only; the LaTeX title/org still render the PDF):
//   Section → clean title + variant tag ("Profile · Clinical") so variants are distinct
//   Entry   → clean title only (org/dates move to the sub-label)
//   Row/Pub → clean, truncated
const cvNodeLabel = (node: ComponentResults): string => {
  const d = node.data ?? {};
  switch (node.type) {
    case CV_TYPE.DOCUMENT:    return d.title || node.name;
    case CV_TYPE.SECTION: {
      const v = cvVariant(node.name);
      return cleanLatex(d.title || node.name) + (v ? ` · ${v}` : '');
    }
    case CV_TYPE.ENTRY:       return truncate(cleanLatex(d.title || node.name), 60);
    case CV_TYPE.TEXTROW:     return truncate(cleanLatex(d.label || d.text || node.name));
    case CV_TYPE.PUBLICATION: return truncate(cleanLatex(d.raw || d.title || node.name));
    default:                  return node.name;
  }
};

// Secondary line for the library list — org/dates for entries; nothing otherwise.
const cvNodeSubLabel = (node: ComponentResults): string => {
  const d = node.data ?? {};
  if (node.type === CV_TYPE.ENTRY) return truncate(cleanLatex([d.org, d.dates].filter(Boolean).join(' · ')), 70);
  return '';
};

const cvFormFetcher = (type: string): Promise<ComponentResults | null | undefined> =>
  ApiService.getComponentByName(CV_EDITOR_ID[type]) as Promise<ComponentResults | null | undefined>;

const getCvDefaultValues = (node: ComponentResults): Record<string, any> => node.data ?? {};

const CV_LINK_GROUPS = [
  { label: 'Sections',     filter: (n: ComponentResults) => n.type === CV_TYPE.SECTION },
  { label: 'Entries',      filter: (n: ComponentResults) => n.type === CV_TYPE.ENTRY },
  { label: 'Rows',         filter: (n: ComponentResults) => n.type === CV_TYPE.TEXTROW },
  { label: 'Publications', filter: (n: ComponentResults) => n.type === CV_TYPE.PUBLICATION },
];


const Cv: React.FC = () => {


/*
 ██████    ████████  ████████    ██████
 ██    ██  ██        ██        ██
 ██████    ██████    ██████      ████
 ██    ██  ██        ██              ██
 ██    ██  ████████  ██        ██████
                                         */


  const libEditorRef = useRef<TreeEditorHandle>(null);


/*
   ██████  ██████████    ████    ██████████  ████████
 ██            ██      ██    ██      ██      ██
   ████        ██      ████████      ██      ██████
       ██      ██      ██    ██      ██      ██
 ██████        ██      ██    ██      ██      ████████
                                                       */


  const [cvVersion, setCvVersion]           = useState(0);
  const [libVersion, setLibVersion]         = useState(0);
  const [selectedDoc, setSelectedDoc]       = useState<ComponentResults | null>(null);
  const [docLoading, setDocLoading]         = useState(false);
  const [rightTab, setRightTab]             = useState(0);

  const [libType, setLibType]               = useState('');
  const [libText, setLibText]               = useState('');

  const [identityForm, setIdentityForm]     = useState<ComponentResults | null>(null);

  // New CV modal
  const [newCvOpen, setNewCvOpen]           = useState(false);
  const [newCvSaving, setNewCvSaving]       = useState(false);
  const [newCvError, setNewCvError]         = useState('');

  // Template pick modal
  const [templateOpen, setTemplateOpen]     = useState(false);
  const [pickedTemplate, setPickedTemplate] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);

  // Preview / compile
  const [previewBlob, setPreviewBlob]       = useState<Blob | null>(null);
  const [compileLoading, setCompileLoading] = useState(false);
  const [compileError, setCompileError]     = useState('');
  const [saveLoading, setSaveLoading]       = useState(false);
  const [saveMsg, setSaveMsg]               = useState('');

  // Name-and-save modal
  const [saveOpen, setSaveOpen]             = useState(false);
  const [saveLabel, setSaveLabel]           = useState('');


/*
 ██          ████      ████    ██████
 ██        ██    ██  ██    ██  ██    ██
 ██        ██    ██  ████████  ██    ██
 ██        ██    ██  ██    ██  ██    ██
 ████████    ████    ██    ██  ██████
                                         */


  useEffect(() => {
    ApiService.getComponentByName(CV_FORM.DOCUMENT).then(f => setIdentityForm((f ?? null) as ComponentResults | null));
  }, []);

  const loadDoc = async (id: string) => {
    setDocLoading(true);
    try {
      const tree = await ApiService.getCvDocument(id);
      setSelectedDoc((tree ?? null) as ComponentResults | null);
    } catch (e) { console.error('Error loading CV:', e); }
    finally { setDocLoading(false); }
  };

  const selectDoc = (id: string) => { setRightTab(0); loadDoc(id); };

  const cvDocFetcher = async (): Promise<(ComponentResults & { id: string })[]> => {
    const list = await ApiService.getCvDocuments();
    return list.filter((d): d is ComponentResults & { id: string } => !!d.id);
  };

  const libFetcher = async (): Promise<(ComponentResults & { id: string })[]> => {
    const [secs, ents, rows, pubs] = await Promise.all([
      ApiService.getCvComponentList(CV_TYPE.SECTION),
      ApiService.getCvComponentList(CV_TYPE.ENTRY),
      ApiService.getCvComponentList(CV_TYPE.TEXTROW),
      ApiService.getCvComponentList(CV_TYPE.PUBLICATION),
    ]);
    return [...secs, ...ents, ...rows, ...pubs].filter((n): n is ComponentResults & { id: string } => !!n.id);
  };

  const treeLinkFetcher = async (): Promise<ComponentResults[]> => libFetcher();


/*
 ██    ██    ████    ██      ██  ██████    ██        ████████  ██████      ██████
 ██    ██  ██    ██  ████    ██  ██    ██  ██        ██        ██    ██  ██
 ████████  ████████  ██  ██  ██  ██    ██  ██        ██████    ██████      ████
 ██    ██  ██    ██  ██    ████  ██    ██  ██        ██        ██    ██        ██
 ██    ██  ██    ██  ██      ██  ██████    ████████  ████████  ██    ██  ██████
                                                                                   */


  // ── Tree (Build tab) ──────────────────────────────────────────────────────────
  // Reload the open doc and bump the CVs list so a root (title) edit relabels it.
  const treeReload = async () => { if (selectedDoc?.id) await loadDoc(selectedDoc.id); setCvVersion(v => v + 1); };

  const treeCreateNode = async (type: string, values: any, parentId: string) => {
    const result = await ApiService.createCvComponent(`${type}_${Date.now()}`, type, values, {}, null);
    const newId  = result?.data?.createCvComponent?.id;
    if (newId) await ApiService.createCvRelation(parentId, newId);
  };

  const treeLinkNode  = async (nodeId: string, parentId: string) => { await ApiService.createCvRelation(parentId, nodeId); };
  const treeSaveNode  = async (node: ComponentResults, values: any) => { await ApiService.updateCvComponent(node.id!, node.name, node.type, values, node.options); };
  // Unlink only detaches — atoms are reusable across CVs. Deletion is the edit modal's Danger Zone.
  const treeUnlink    = async (nodeId: string, parentId: string) => { await ApiService.deleteCvRelation(parentId, nodeId); };
  const treeDeleteNode = async (node: ComponentResults) => { await ApiService.deleteCvComponent(node.id!); };
  const treeMove      = async (nodeId: string, swapWithId: string, parentId: string) => { await ApiService.swapCvPositions(parentId, nodeId, swapWithId); };

  // ── Library (hidden editor) ───────────────────────────────────────────────────
  const libReload     = async () => { setLibVersion(v => v + 1); if (selectedDoc?.id) await loadDoc(selectedDoc.id); };
  const libSaveNode   = async (node: ComponentResults, values: any) => { await ApiService.updateCvComponent(node.id!, node.name, node.type, values, node.options); };
  const libDeleteNode = async (node: ComponentResults) => { await ApiService.deleteCvComponent(node.id!); };

  // ── New CV ────────────────────────────────────────────────────────────────────
  const handleCreateCv = async (values: any) => {
    setNewCvError('');
    setNewCvSaving(true);
    try {
      const data = { ...values, template_id: values.template_id || CV_DEFAULT_TEMPLATE_ID };
      const doc  = await ApiService.createCvDocument(`cv_document_${Date.now()}`, data);
      setNewCvOpen(false);
      setCvVersion(v => v + 1);
      if (doc?.id) selectDoc(doc.id);
    } catch (e: any) {
      setNewCvError(e.message ?? 'Failed to create CV');
    } finally {
      setNewCvSaving(false);
    }
  };

  // ── Template pick ─────────────────────────────────────────────────────────────
  const openTemplatePicker = () => { setPickedTemplate(selectedDoc?.data?.template_id ?? null); setTemplateOpen(true); };
  const applyTemplate = async () => {
    if (!selectedDoc?.id || !pickedTemplate) return;
    setTemplateSaving(true);
    try {
      await ApiService.updateCvDocument(selectedDoc.id, { ...selectedDoc.data, template_id: pickedTemplate });
      await loadDoc(selectedDoc.id);
      setTemplateOpen(false);
    } finally {
      setTemplateSaving(false);
    }
  };

  // ── Compile / save / artifacts ─────────────────────────────────────────────────
  const handleCompile = async () => {
    if (!selectedDoc?.id) return;
    setCompileError(''); setSaveMsg(''); setCompileLoading(true);
    try {
      setPreviewBlob(await ApiService.compileCv(selectedDoc.id));
    } catch (e: any) {
      setCompileError((e.message ?? 'Compilation failed') + (e.log ? `\n\n${e.log}` : ''));
    } finally {
      setCompileLoading(false);
    }
  };

  // Open the name-and-save modal, defaulting the name to the CV title.
  const openSaveModal = () => { setSaveMsg(''); setSaveLabel(selectedDoc ? cvNodeLabel(selectedDoc) : ''); setSaveOpen(true); };

  const handleSavePdf = async () => {
    if (!selectedDoc?.id) return;
    setCompileError(''); setSaveMsg(''); setSaveLoading(true);
    try {
      await ApiService.saveCvPdf(selectedDoc.id, saveLabel.trim() || undefined);
      setSaveOpen(false);
      setSaveMsg('Saved — find it under Generated CVs.');
    } catch (e: any) {
      setCompileError((e.message ?? 'Save failed') + (e.log ? `\n\n${e.log}` : ''));
    } finally {
      setSaveLoading(false);
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
          <strong style={{ color: 'var(--ion-text-color)' }}>CV Builder</strong>
          {' — '}assemble a LaTeX CV from your reusable section library, set your identity values,
          then <strong>Compile</strong> to a live PDF and <strong>Save</strong> it to your generated CVs.
        </div>
      }
      hidden={
        /* ═══════════════════════════════════════════════════════════
             Cards library                                             */
        <TreeEditor
          ref={libEditorRef}
          root={null}
          onReload={libReload}
          isContainer={() => false}
          addableTypes={[]}
          formFetcher={cvFormFetcher}
          getDefaultValues={getCvDefaultValues}
          getLabel={cvNodeLabel}
          getBadgeLabel={node => cvBadgeLabel(node.type)}
          getBadgeColor={node => cvBadgeColor(node.type)}
          onCreateNode={async () => {}}
          onLinkNode={async () => {}}
          onUnlink={async () => {}}
          onSaveNode={libSaveNode}
          onDeleteNode={libDeleteNode}
          parentsFetcher={node => ApiService.getCvComponentParents(node.id!)}
        />
      }
      leftTabs={[
        {
          label: 'CVs',
          content: (
            /* ═══════════════════════════════════════════════════════════
                 Component list                                            */
            <ResourcePanel
              fetcher={cvDocFetcher}
              refreshToken={cvVersion}
              config={PANEL_CONFIG.CV_DOCUMENTS}
              selectedId={selectedDoc?.id}
              getLabel={cvNodeLabel}
              getIcon={() => documentTextOutline}
              onSelect={d => selectDoc(d.id)}
              onAdd={() => { setNewCvError(''); setNewCvOpen(true); }}
            />
          ),
        },
        {
          label: 'Library',
          content: (
            /* ═══════════════════════════════════════════════════════════
                 Cards library                                             */
            <ResourcePanel
              fetcher={libFetcher}
              refreshToken={libVersion}
              config={PANEL_CONFIG.CV_LIBRARY}
              getLabel={cvNodeLabel}
              getSubLabel={cvNodeSubLabel}
              getBadge={c => ({ label: cvBadgeLabel(c.type), color: cvBadgeColor(c.type) })}
              onSelect={c => libEditorRef.current?.openEdit(c)}
              filterFn={(c, text, typeValue) =>
                (!typeValue || c.type === typeValue) &&
                (!text || cvNodeLabel(c).toLowerCase().includes(text.toLowerCase()))
              }
              filter={{ typeValue: libType, onTypeChange: setLibType, text: libText, onTextChange: setLibText }}
            />
          ),
        },
      ]}
      right={
        <TabPanel
          activeTab={rightTab}
          onTabChange={setRightTab}
          tabs={[
            {
              label: 'Build',
              content: (
                /* ═══════════════════════════════════════════════════════════
                     Build                                                     */
                <>
                  {docLoading && (
                    <IonItem lines="none"><IonSpinner slot="start" name="dots" />&nbsp;Loading…</IonItem>
                  )}
                  {!docLoading && !selectedDoc && <EmptyState message="Select or create a CV to begin" />}
                  {!docLoading && selectedDoc && (
                    <TreeEditor
                      root={selectedDoc as ComponentResults}
                      title={cvNodeLabel(selectedDoc)}
                      rootEditable
                      onReload={treeReload}
                      isContainer={node => node.type === CV_TYPE.DOCUMENT || node.type === CV_TYPE.SECTION}
                      getLabel={cvNodeLabel}
                      getBadgeLabel={node => cvBadgeLabel(node.type)}
                      getBadgeColor={node => cvBadgeColor(node.type)}
                      formFetcher={cvFormFetcher}
                      addableTypes={CV_ADDABLE_TYPES}
                      getDefaultValues={getCvDefaultValues}
                      linkableFetcher={treeLinkFetcher}
                      linkableGroups={CV_LINK_GROUPS}
                      onCreateNode={treeCreateNode}
                      onLinkNode={treeLinkNode}
                      onSaveNode={treeSaveNode}
                      onUnlink={treeUnlink}
                      onMoveNode={treeMove}
                      onDeleteNode={treeDeleteNode}
                      parentsFetcher={node => ApiService.getCvComponentParents(node.id!)}
                      editExtra={node => node.type === CV_TYPE.DOCUMENT ? (
                        <IonItem lines="none">
                          <IonButton size="small" fill="outline" onClick={openTemplatePicker}>Choose template</IonButton>
                        </IonItem>
                      ) : null}
                      addLabel="Add"
                      emptyMessage="No sections yet — add or link one."
                    />
                  )}
                </>
              ),
            },
            {
              label: 'Preview',
              content: (
                /* ═══════════════════════════════════════════════════════════
                     Preview                                                   */
                <>
                  {!selectedDoc && !previewBlob && <EmptyState message="Select a CV to preview" />}
                  {(selectedDoc || previewBlob) && (
                    <>
                      {selectedDoc && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                          <IonButton size="small" onClick={handleCompile} disabled={compileLoading}>
                            {compileLoading ? 'Compiling…' : 'Compile'}
                          </IonButton>
                          <IonButton size="small" color="success" onClick={openSaveModal} disabled={saveLoading || !previewBlob}>
                            Save PDF
                          </IonButton>
                          {saveMsg && <IonText color="success" style={{ fontSize: 13 }}>{saveMsg}</IonText>}
                        </div>
                      )}
                      {compileError && (
                        <pre style={{
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12,
                          background: 'var(--ion-color-light)', color: 'var(--ion-color-danger)',
                          padding: '8px 12px', borderRadius: 8, maxHeight: 260, overflowY: 'auto',
                        }}>{compileError}</pre>
                      )}
                      {!(compileError && !previewBlob) && (
                        <PdfViewer blob={previewBlob} title="CV preview" emptyMessage="Press Compile to render the PDF" />
                      )}
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      }
    >
      {/* ═══════════════════════════════════════════════════════════
           Modals                                                    */}
      <ModalShell isOpen={newCvOpen} onDismiss={() => setNewCvOpen(false)} title="New CV">
        {newCvError && <IonItem lines="none"><IonText color="danger">{newCvError}</IonText></IonItem>}
        {identityForm && (
          <FormRenderer
            component={identityForm}
            defaultValues={{ template_id: CV_DEFAULT_TEMPLATE_ID }}
            onSubmit={handleCreateCv}
            submitLabel={newCvSaving ? 'Creating…' : 'Create CV'}
          />
        )}
      </ModalShell>

      <ModalShell isOpen={templateOpen} onDismiss={() => setTemplateOpen(false)} title="Choose Template">
        <ResourcePanel
          fetcher={async () => {
            const list = await ApiService.getCvComponentList(CV_TYPE.TEMPLATE);
            return list.filter((t): t is ComponentResults & { id: string } => !!t.id);
          }}
          refreshToken={0}
          title="Templates"
          selectedId={pickedTemplate}
          getLabel={t => t.name}
          getBadge={() => ({ label: 'Template', color: 'medium' })}
          onSelect={t => setPickedTemplate(t.id)}
        />
        <IonButton expand="block" disabled={!pickedTemplate || templateSaving} onClick={applyTemplate}>
          {templateSaving ? 'Applying…' : 'Use this template'}
        </IonButton>
      </ModalShell>

      <ModalShell isOpen={saveOpen} onDismiss={() => setSaveOpen(false)} title="Save PDF">
        <IonItem lines="full">
          <IonInput
            label="Name" labelPlacement="stacked"
            placeholder="e.g. Clinical DS — Google"
            value={saveLabel}
            onIonInput={e => setSaveLabel(e.detail.value ?? '')}
          />
        </IonItem>
        <IonButton expand="block" color="success" disabled={saveLoading} onClick={handleSavePdf}>
          {saveLoading ? 'Saving…' : 'Save to Generated CVs'}
        </IonButton>
      </ModalShell>
    </SplitPageLayout>
  );
};

export default Cv;
