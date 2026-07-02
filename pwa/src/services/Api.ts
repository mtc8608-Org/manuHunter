import axios from 'axios';
import { createClient } from 'graphql-http';
import { API_BASE, GQL_URL, ENDPOINT } from '../constants';
import { Application, ComponentResults, FileRecord, Survey, SurveyAnswer } from '../interfaces/types';

// ── Setup ────────────────────────────────────────────────────────────────────

const http = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-type': 'application/json' },
});

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

http.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const client = createClient({
  url: GQL_URL,
  headers: () => getAuthHeader(),
});

const gql = (query: string, variables?: Record<string, any>): Promise<any> =>
  new Promise((resolve, reject) => {
    let result: any;
    client.subscribe(
      { query, variables },
      { next: (data) => (result = data), error: reject, complete: () => resolve(result) }
    );
  });

// ── Component tree generics ───────────────────────────────────────────────────

type Domain = 'app' | 'survey' | 'cv';

const TREE_FIELDS = `
  id name type data options
  children { id name type data options
    children { id name type data options
      children { id name type data options
        children { id name type data options
          children { id name type data options
            children { id name type data options }
          }
        }
      }
    }
  }
`.trim();

const OPS: Record<Domain, {
  getOne: string; getList: string;
  create: string; createInput: string;
  update: string; del: string;
  link: string; unlink: string;
}> = {
  app: {
    getOne:      'component',        getList:     'componentList',
    create:      'createComponent',  createInput: 'ComponentInput',
    update:      'updateComponent',  del:         'deleteComponent',
    link:        'createComponentRelation',
    unlink:      'deleteComponentRelation',
  },
  survey: {
    getOne:      'surveyComponent',        getList:     'surveyComponentList',
    create:      'createSurveyComponent',  createInput: 'SurveyComponentInput',
    update:      'updateSurveyComponent',  del:         'deleteSurveyComponent',
    link:        'createSurveyComponentRelation',
    unlink:      'deleteSurveyComponentRelation',
  },
  cv: {
    getOne:      'cvComponent',        getList:     'cvComponentList',
    create:      'createCvComponent',  createInput: 'CvComponentInput',
    update:      'updateCvComponent',  del:         'deleteCvComponent',
    link:        'createCvRelation',
    unlink:      'deleteCvRelation',
  },
};

const SWAP_MUT: Record<Domain, string> = {
  app:    'swapComponentPositions',
  survey: 'swapSurveyComponentPositions',
  cv:     'swapCvPositions',
};

const getComponentByName = async (name: string): Promise<ComponentResults | undefined> => {
  try {
    const result = await gql(`
      query ComponentByName($name: String) { componentByName(name: $name) { ${TREE_FIELDS} } }
    `, { name });
    return result?.data?.componentByName;
  } catch (e) { console.error('Error fetching component by name:', e); }
};

const getNodeTree = async (domain: Domain, id: string): Promise<ComponentResults | undefined> => {
  const { getOne } = OPS[domain];
  try {
    const result = await gql(`
      query NodeTree($id: String) { ${getOne}(id: $id) { ${TREE_FIELDS} } }
    `, { id });
    return result?.data?.[getOne]?.[0];
  } catch (e) { console.error(`Error fetching ${domain} node tree:`, e); }
};

const getNodeList = async (domain: Domain, type?: string): Promise<ComponentResults[]> => {
  const { getList } = OPS[domain];
  try {
    const result = await gql(`
      query NodeList($type: String) { ${getList}(type: $type) { id name type data options } }
    `, { type });
    return result?.data?.[getList] ?? [];
  } catch (e) { console.error(`Error fetching ${domain} node list:`, e); return []; }
};

const createNode = async (domain: Domain, name: string, type: string, data: any, options: any, children: any) => {
  const { create, createInput } = OPS[domain];
  try {
    return await gql(`
      mutation CreateNode($name: String!, $type: String, $data: JSON, $options: JSON, $children: [${createInput}]) {
        ${create}(name: $name, type: $type, data: $data, options: $options, children: $children) {
          id name type data options children { name type }
        }
      }
    `, { name, type, data, options, children });
  } catch (e) { console.error(`Error creating ${domain} node:`, e); }
};

const updateNode = async (domain: Domain, id: string, name: string, type: string, data: any, options: any) => {
  const { update } = OPS[domain];
  try {
    return await gql(`
      mutation UpdateNode($id: ID!, $name: String, $type: String, $data: JSON, $options: JSON) {
        ${update}(id: $id, name: $name, type: $type, data: $data, options: $options) {
          id name type data options
        }
      }
    `, { id, name, type, data, options });
  } catch (e) { console.error(`Error updating ${domain} node:`, e); }
};

const deleteNode = async (domain: Domain, id: string) => {
  const { del } = OPS[domain];
  try {
    return await gql(`mutation DeleteNode($id: ID!) { ${del}(id: $id) }`, { id });
  } catch (e) { console.error(`Error deleting ${domain} node:`, e); }
};

const linkNodes = async (domain: Domain, parent_id: string, child_id: string, position?: number) => {
  const { link } = OPS[domain];
  const withPos = position !== undefined;
  try {
    return await gql(
      withPos
        ? `mutation Link($parent_id: ID!, $child_id: ID!, $position: Float) { ${link}(parent_id: $parent_id, child_id: $child_id, position: $position) }`
        : `mutation Link($parent_id: ID!, $child_id: ID!) { ${link}(parent_id: $parent_id, child_id: $child_id) }`,
      withPos ? { parent_id, child_id, position } : { parent_id, child_id }
    );
  } catch (e) { console.error(`Error linking ${domain} nodes:`, e); }
};

const unlinkNodes = async (domain: Domain, parent_id: string, child_id: string) => {
  const { unlink } = OPS[domain];
  try {
    return await gql(`
      mutation Unlink($parent_id: ID!, $child_id: ID!) { ${unlink}(parent_id: $parent_id, child_id: $child_id) }
    `, { parent_id, child_id });
  } catch (e) { console.error(`Error unlinking ${domain} nodes:`, e); }
};

const swapNodes = async (domain: Domain, parent_id: string, child_id_a: string, child_id_b: string) => {
  const mut = SWAP_MUT[domain];
  try {
    return await gql(`
      mutation Swap($parent_id: ID!, $child_id_a: ID!, $child_id_b: ID!) {
        ${mut}(parent_id: $parent_id, child_id_a: $child_id_a, child_id_b: $child_id_b)
      }
    `, { parent_id, child_id_a, child_id_b });
  } catch (e) { console.error(`Error swapping ${domain} positions:`, e); }
};

// ── components ───────────────────────────────────────────────────────────────

const getList       = (type: string)                                                       => getNodeList('app', type);
const getComponent  = (id: string)                                                         => getNodeTree('app', id);
const createComponent = (name: string, type: string, data: any, options: any, children: any) => createNode('app', name, type, data, options, children);
const updateComponent = (id: string, name: string, type: string, data: any, options: any)    => updateNode('app', id, name, type, data, options);
const deleteComponent = (id: string)                                                         => deleteNode('app', id);

const getComponentParents = async (child_id: string): Promise<ComponentResults[]> => {
  try {
    const result = await gql(`
      query ComponentParents($child_id: ID!) {
        componentParents(child_id: $child_id) { id name type data options }
      }
    `, { child_id });
    return result?.data?.componentParents ?? [];
  } catch (e) { console.error('Error fetching component parents:', e); return []; }
};

// ── component_relationships ───────────────────────────────────────────────────

const getRelationsList = async (): Promise<any[]> => {
  try {
    const result = await gql(`
      query { componentRelationList { parent_name parent_id child_name child_id } }
    `);
    return result?.data?.componentRelationList ?? [];
  } catch (e) { console.error('Error fetching relations:', e); return []; }
};

const createRelation        = (parent_id: string, child_id: string)                           => linkNodes('app', parent_id, child_id);
const deleteRelation        = (parent_id: string, child_id: string)                           => unlinkNodes('app', parent_id, child_id);
const swapComponentPositions = (parent_id: string, child_id_a: string, child_id_b: string)   => swapNodes('app', parent_id, child_id_a, child_id_b);

// ── survey_components ─────────────────────────────────────────────────────────

const getSurveyComponent     = (id: string)                                                          => getNodeTree('survey', id);
const getSurveyComponentList = (type?: string)                                                       => getNodeList('survey', type);
const createSurveyComponent  = (name: string, type: string, data: any, options: any, children: any) => createNode('survey', name, type, data, options, children);
const updateSurveyComponent  = (id: string, name: string, type: string, data: any, options: any)    => updateNode('survey', id, name, type, data, options);
const deleteSurveyComponent  = (id: string)                                                          => deleteNode('survey', id);
const createSurveyComponentRelation   = (parent_id: string, child_id: string, position: number)   => linkNodes('survey', parent_id, child_id, position);
const deleteSurveyComponentRelation   = (parent_id: string, child_id: string)                       => unlinkNodes('survey', parent_id, child_id);
const swapSurveyComponentPositions    = (parent_id: string, child_id_a: string, child_id_b: string) => swapNodes('survey', parent_id, child_id_a, child_id_b);

const getSurveyComponentParents = async (child_id: string): Promise<ComponentResults[]> => {
  try {
    const result = await gql(`
      query SurveyComponentParents($child_id: ID!) {
        surveyComponentParents(child_id: $child_id) { id name type data options }
      }
    `, { child_id });
    return result?.data?.surveyComponentParents ?? [];
  } catch (e) { console.error('Error fetching survey component parents:', e); return []; }
};

// ── surveys ───────────────────────────────────────────────────────────────────

const getSurveys = async (): Promise<Survey[]> => {
  try {
    const result = await gql(`
      query { surveyList { id component_id title is_active created_at } }
    `);
    return result?.data?.surveyList ?? [];
  } catch (e) { console.error('Error fetching surveys:', e); return []; }
};

const getSurveyAnswers = async (survey_id: string, filter?: Record<string, any>): Promise<SurveyAnswer[]> => {
  try {
    const result = await gql(`
      query SurveyAnswers($survey_id: ID!, $filter: JSON) {
        surveyAnswers(survey_id: $survey_id, filter: $filter) {
          id survey_id answers submitted_at
        }
      }
    `, { survey_id, filter: filter ?? {} });
    return result?.data?.surveyAnswers ?? [];
  } catch (e) { console.error('Error fetching survey answers:', e); return []; }
};

const submitAnswer = async (survey_id: string, answers: Record<string, any>) => {
  try {
    return await gql(`
      mutation SubmitAnswer($survey_id: ID!, $answers: JSON) {
        submitAnswer(survey_id: $survey_id, answers: $answers) {
          id survey_id answers submitted_at
        }
      }
    `, { survey_id, answers });
  } catch (e) { console.error('Error submitting answer:', e); }
};

const updateAnswer = async (id: string, answers: Record<string, any>) => {
  try {
    return await gql(`
      mutation UpdateAnswer($id: ID!, $answers: JSON) {
        updateAnswer(id: $id, answers: $answers) {
          id survey_id answers submitted_at
        }
      }
    `, { id, answers });
  } catch (e) { console.error('Error updating answer:', e); }
};

const deleteAnswer = async (id: string) => {
  try {
    return await gql(`
      mutation DeleteAnswer($id: ID!) { deleteAnswer(id: $id) }
    `, { id });
  } catch (e) { console.error('Error deleting answer:', e); }
};

const getSurveyStats = async (survey_id: string): Promise<any | null> => {
  try {
    const result = await gql(`
      query SurveyStats($survey_id: ID!) { surveyStats(survey_id: $survey_id) }
    `, { survey_id });
    return result?.data?.surveyStats ?? null;
  } catch (e) { console.error('Error fetching survey stats:', e); return null; }
};

const createSurvey = async (component_id: string, title: string) => {
  try {
    return await gql(`
      mutation CreateSurvey($component_id: ID!, $title: String) {
        createSurvey(component_id: $component_id, title: $title) {
          id component_id title is_active created_at
        }
      }
    `, { component_id, title });
  } catch (e) { console.error('Error creating survey:', e); }
};

// ── end survey system ─────────────────────────────────────────────────────────

// ── auth & user management ────────────────────────────────────────────────────

const changePassword = async (currentPassword: string, newPassword: string) => {
  const res = await fetch(`${API_BASE}${ENDPOINT.CHANGE_PASSWORD}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body:    JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Change password failed');
  }
  return res.json();
};

const getUsers = async () => {
  const res = await fetch(`${API_BASE}${ENDPOINT.USERS}`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
};

const createUser = async (email: string, password: string, role: string) => {
  const res = await fetch(`${API_BASE}${ENDPOINT.USERS}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body:    JSON.stringify({ email, password, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to create user');
  }
  return res.json();
};

const patchUser = async (id: string, updates: { is_active?: boolean; role?: string }) => {
  const res = await fetch(`${API_BASE}${ENDPOINT.USERS}/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body:    JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update user');
  return res.json();
};

// ── files ─────────────────────────────────────────────────────────────────────

const getFiles = async (): Promise<FileRecord[]> => {
  const res = await fetch(`${API_BASE}${ENDPOINT.FILES}`, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('Failed to fetch files');
  return res.json();
};

const uploadFile = async (file: File, description?: string) => {
  const form = new FormData();
  form.append('file', file);
  if (description) form.append('description', description);
  const res = await fetch(`${API_BASE}${ENDPOINT.FILES_UPLOAD}`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error((err as any).error ?? 'Upload failed') as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  return res.json();
};

const patchFile = async (id: string, description: string) => {
  const res = await fetch(`${API_BASE}${ENDPOINT.FILES}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error('Failed to update file');
  return res.json();
};

const deleteFile = async (id: string) => {
  const res = await fetch(`${API_BASE}${ENDPOINT.FILES}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error('Failed to delete file');
  return res.json();
};

// Fetch a stored file's bytes (auth header) for download or preview.
const fetchFileBlob = async (id: string): Promise<Blob> => {
  const res = await fetch(`${API_BASE}${ENDPOINT.FILES}/${id}/download`, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('Download failed');
  return res.blob();
};

// ── applications (jobs domain) ─────────────────────────────────────────────────

const APPLICATION_FIELDS = `
  id user_id company role location source job_url job_description
  status salary contact notes applied_at created_at updated_at
`.trim();

const APPLICATION_DETAIL_FIELDS = `
  ${APPLICATION_FIELDS}
  events { id event_type detail occurred_at }
  files  { id filename mime_type size kind }
`.trim();

const getApplications = async (status?: string): Promise<Application[]> => {
  try {
    const result = await gql(`
      query Applications($status: String) { applications(status: $status) { ${APPLICATION_FIELDS} } }
    `, { status });
    return result?.data?.applications ?? [];
  } catch (e) { console.error('Error fetching applications:', e); return []; }
};

const getApplication = async (id: string): Promise<Application | null> => {
  try {
    const result = await gql(`
      query Application($id: ID!) { application(id: $id) { ${APPLICATION_DETAIL_FIELDS} } }
    `, { id });
    return result?.data?.application ?? null;
  } catch (e) { console.error('Error fetching application:', e); return null; }
};

const createApplication = async (input: Partial<Application>): Promise<Application | null> => {
  try {
    const result = await gql(`
      mutation CreateApplication(
        $company: String!, $role: String!, $location: String, $source: String,
        $job_url: String, $job_description: String, $status: String,
        $salary: String, $contact: String, $notes: String, $applied_at: String
      ) {
        createApplication(
          company: $company, role: $role, location: $location, source: $source,
          job_url: $job_url, job_description: $job_description, status: $status,
          salary: $salary, contact: $contact, notes: $notes, applied_at: $applied_at
        ) { ${APPLICATION_FIELDS} }
      }
    `, input);
    return result?.data?.createApplication ?? null;
  } catch (e) { console.error('Error creating application:', e); throw e; }
};

const updateApplication = async (id: string, input: Partial<Application>): Promise<Application | null> => {
  try {
    const result = await gql(`
      mutation UpdateApplication(
        $id: ID!, $company: String, $role: String, $location: String, $source: String,
        $job_url: String, $job_description: String, $status: String,
        $salary: String, $contact: String, $notes: String, $applied_at: String
      ) {
        updateApplication(
          id: $id, company: $company, role: $role, location: $location, source: $source,
          job_url: $job_url, job_description: $job_description, status: $status,
          salary: $salary, contact: $contact, notes: $notes, applied_at: $applied_at
        ) { ${APPLICATION_FIELDS} }
      }
    `, { id, ...input });
    return result?.data?.updateApplication ?? null;
  } catch (e) { console.error('Error updating application:', e); throw e; }
};

const deleteApplication = async (id: string) => {
  try {
    return await gql(`mutation DeleteApplication($id: ID!) { deleteApplication(id: $id) }`, { id });
  } catch (e) { console.error('Error deleting application:', e); }
};

const addApplicationEvent = async (application_id: string, event_type: string, detail?: string) => {
  try {
    return await gql(`
      mutation AddEvent($application_id: ID!, $event_type: String!, $detail: String) {
        addApplicationEvent(application_id: $application_id, event_type: $event_type, detail: $detail) {
          id event_type detail occurred_at
        }
      }
    `, { application_id, event_type, detail });
  } catch (e) { console.error('Error adding application event:', e); }
};

// Upload a tailored artifact and link it to the application in one call (REST).
const uploadApplicationFile = async (applicationId: string, file: File, kind: string) => {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  const res = await fetch(`${API_BASE}${ENDPOINT.APPLICATIONS}/${applicationId}/files`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error((err as any).error ?? 'Upload failed') as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  return res.json();
};

// Link an already-stored file (e.g. a generated CV) to an application — no upload.
const linkApplicationFile = async (application_id: string, file_id: string, kind: string) => {
  return gql(`
    mutation Link($application_id: ID!, $file_id: ID!, $kind: String) {
      linkApplicationFile(application_id: $application_id, file_id: $file_id, kind: $kind)
    }
  `, { application_id, file_id, kind });
};

const unlinkApplicationFile = async (application_id: string, file_id: string) => {
  try {
    return await gql(`
      mutation Unlink($application_id: ID!, $file_id: ID!) {
        unlinkApplicationFile(application_id: $application_id, file_id: $file_id)
      }
    `, { application_id, file_id });
  } catch (e) { console.error('Error unlinking application file:', e); }
};

// ── CV builder (cv domain) ─────────────────────────────────────────────────────

const getCvComponentList = (type?: string)                                                        => getNodeList('cv', type);
const getCvComponent     = (id: string)                                                            => getNodeTree('cv', id);
const createCvComponent  = (name: string, type: string, data: any, options: any, children: any)   => createNode('cv', name, type, data, options, children);
const updateCvComponent  = (id: string, name: string, type: string, data: any, options: any)      => updateNode('cv', id, name, type, data, options);
const deleteCvComponent  = (id: string)                                                            => deleteNode('cv', id);
const createCvRelation   = (parent_id: string, child_id: string)                                   => linkNodes('cv', parent_id, child_id);
const deleteCvRelation   = (parent_id: string, child_id: string)                                   => unlinkNodes('cv', parent_id, child_id);
const swapCvPositions    = (parent_id: string, child_id_a: string, child_id_b: string)             => swapNodes('cv', parent_id, child_id_a, child_id_b);

const getCvComponentParents = async (child_id: string): Promise<ComponentResults[]> => {
  try {
    const result = await gql(`
      query CvComponentParents($child_id: ID!) {
        cvComponentParents(child_id: $child_id) { id name type data options owner_id }
      }
    `, { child_id });
    return result?.data?.cvComponentParents ?? [];
  } catch (e) { console.error('Error fetching cv component parents:', e); return []; }
};

const getCvDocuments = async (): Promise<ComponentResults[]> => {
  try {
    const result = await gql(`query { cvDocumentList { id name type data options owner_id } }`);
    return result?.data?.cvDocumentList ?? [];
  } catch (e) { console.error('Error fetching cv documents:', e); return []; }
};

const getCvDocument = (id: string) => getCvComponent(id);

const createCvDocument = async (name: string, data: any): Promise<ComponentResults | null> => {
  try {
    const result = await gql(`
      mutation CreateCvDocument($name: String, $data: JSON) {
        createCvDocument(name: $name, data: $data) { id name type data options owner_id }
      }
    `, { name, data });
    return result?.data?.createCvDocument ?? null;
  } catch (e) { console.error('Error creating cv document:', e); throw e; }
};

const updateCvDocument = async (id: string, data: any, name?: string): Promise<ComponentResults | null> => {
  try {
    const result = await gql(`
      mutation UpdateCvDocument($id: ID!, $name: String, $data: JSON) {
        updateCvDocument(id: $id, name: $name, data: $data) { id name type data options owner_id }
      }
    `, { id, name, data });
    return result?.data?.updateCvDocument ?? null;
  } catch (e) { console.error('Error updating cv document:', e); throw e; }
};

const deleteCvDocument = async (id: string) => {
  try {
    return await gql(`mutation DeleteCvDocument($id: ID!) { deleteCvDocument(id: $id) }`, { id });
  } catch (e) { console.error('Error deleting cv document:', e); }
};

export interface UserProfile { owner_id: string | null; data: Record<string, any>; }

// The caller's own profile (form-driven display data; here the CV identity block).
const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const result = await gql(`query { userProfile { owner_id data } }`);
    return result?.data?.userProfile ?? null;
  } catch (e) { console.error('Error fetching user profile:', e); return null; }
};

const upsertUserProfile = async (data: Record<string, any>): Promise<UserProfile | null> => {
  try {
    const result = await gql(`
      mutation UpsertUserProfile($data: JSON) {
        upsertUserProfile(data: $data) { owner_id data }
      }`, { data });
    return result?.data?.upsertUserProfile ?? null;
  } catch (e) { console.error('Error saving user profile:', e); throw e; }
};

// ── User secrets keychain — metadata only, the raw value is write-only ────────

export interface UserSecret {
  name: string; label: string; isSet: boolean;
  last4: string | null; updated_at: string | null;
}

const getUserSecrets = async (): Promise<UserSecret[]> => {
  try {
    const result = await gql(`query { userSecrets { name label isSet last4 updated_at } }`);
    return result?.data?.userSecrets ?? [];
  } catch (e) { console.error('Error fetching user secrets:', e); return []; }
};

const setUserSecret = async (name: string, value: string): Promise<UserSecret | null> => {
  try {
    const result = await gql(`
      mutation SetUserSecret($name: String!, $value: String!) {
        setUserSecret(name: $name, value: $value) { name label isSet last4 updated_at }
      }`, { name, value });
    return result?.data?.setUserSecret ?? null;
  } catch (e) { console.error('Error saving user secret:', e); throw e; }
};

const clearUserSecret = async (name: string): Promise<boolean> => {
  try {
    const result = await gql(`
      mutation ClearUserSecret($name: String!) { clearUserSecret(name: $name) }`, { name });
    return result?.data?.clearUserSecret ?? false;
  } catch (e) { console.error('Error clearing user secret:', e); throw e; }
};

export interface CvArtifact {
  id: string; cv_component_id: string | null; file_id: string; label: string | null;
  created_at: string; filename: string; mime_type: string | null; size: string | null;
}

const getCvArtifacts = async (): Promise<CvArtifact[]> => {
  try {
    const result = await gql(`
      query { cvArtifactList {
        id cv_component_id file_id label created_at filename mime_type size
      } }
    `);
    return result?.data?.cvArtifactList ?? [];
  } catch (e) { console.error('Error fetching cv artifacts:', e); return []; }
};

// Compile the assembled CV and return the PDF as a Blob for the preview viewer.
const compileCv = async (id: string): Promise<Blob> => {
  const res = await fetch(`${API_BASE}${ENDPOINT.CV}/${id}/compile`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error((err as any).error ?? 'Compilation failed') as Error & { log?: string };
    e.log = (err as any).log;
    throw e;
  }
  return res.blob();
};

// Compile and persist the PDF as a cv_artifacts row; returns the artifact.
const saveCvPdf = async (id: string, label?: string): Promise<CvArtifact> => {
  const res = await fetch(`${API_BASE}${ENDPOINT.CV}/${id}/save-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error((err as any).error ?? 'Save failed') as Error & { log?: string };
    e.log = (err as any).log;
    throw e;
  }
  return res.json();
};

const fetchCvArtifactBlob = async (id: string): Promise<Blob> => {
  const res = await fetch(`${API_BASE}${ENDPOINT.CV}/artifacts/${id}/download`, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('Download failed');
  return res.blob();
};

const deleteCvArtifact = async (id: string) => {
  const res = await fetch(`${API_BASE}${ENDPOINT.CV}/artifacts/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
};

// ── AI content generation ─────────────────────────────────────────────────────

export interface GenMessage { role: 'user' | 'assistant'; content: string; }
export interface GenNode    { name: string; type: string; data: Record<string, any>; options: Record<string, any>; }
export interface GenResult  { userMessage: string; userSummary: string; assistantRaw: string; message: string; nodes: GenNode[]; }

const generateContent = async (
  files: File[],
  history: GenMessage[],
  userText: string,
  onDelta: (text: string) => void,
  onNode:  (node: GenNode) => void,
): Promise<GenResult> => {
  const form = new FormData();
  form.append('history', JSON.stringify(history));
  form.append('userText', userText);
  for (const f of files) form.append('files', f);
  const res = await fetch(`${API_BASE}${ENDPOINT.GENERATE_CONTENT}`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Generation failed');
  }
  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: GenResult | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === 'delta')      onDelta(event.text);
      else if (event.type === 'node')  onNode(event.node as GenNode);
      else if (event.type === 'done')  result = event as GenResult;
      else if (event.type === 'error') throw new Error(event.error);
    }
  }
  if (!result) throw new Error('No result received');
  return result;
};

// ── export ───────────────────────────────────────────────────────────────────

const ApiService = {
  // components
  getList, getComponent, getComponentByName, createComponent, updateComponent, deleteComponent, getComponentParents,
  // component_relationships
  getRelationsList, createRelation, deleteRelation, swapComponentPositions,
  // survey_components
  getSurveyComponent, getSurveyComponentList, getSurveyComponentParents,
  createSurveyComponent, updateSurveyComponent, deleteSurveyComponent,
  createSurveyComponentRelation, deleteSurveyComponentRelation, swapSurveyComponentPositions,
  // surveys
  getSurveys, getSurveyAnswers, getSurveyStats, submitAnswer, updateAnswer, deleteAnswer, createSurvey,
  // auth & user management
  changePassword, getUsers, createUser, patchUser,
  // account self-service (profile + secrets keychain)
  getUserProfile, upsertUserProfile, getUserSecrets, setUserSecret, clearUserSecret,
  // files
  getFiles, uploadFile, patchFile, deleteFile, fetchFileBlob,
  // applications (jobs domain)
  getApplications, getApplication, createApplication, updateApplication, deleteApplication,
  addApplicationEvent, uploadApplicationFile, linkApplicationFile, unlinkApplicationFile,
  // cv builder
  getCvComponentList, getCvComponent, createCvComponent, updateCvComponent, deleteCvComponent,
  createCvRelation, deleteCvRelation, swapCvPositions, getCvComponentParents,
  getCvDocuments, getCvDocument, createCvDocument, updateCvDocument, deleteCvDocument,
  getCvArtifacts, compileCv, saveCvPdf, fetchCvArtifactBlob, deleteCvArtifact,
  // AI content generation
  generateContent,
};
export default ApiService;
