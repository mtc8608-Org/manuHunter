// Page: Account — self-service account settings (profile, integrations, password).
// Reads/writes: user_profile + user_secrets (GraphQL), /change-password (REST).
// Authenticated. User management is the admin backoffice Users page.
import React, { useEffect, useState } from 'react';
import {
  IonPage, IonContent,
  IonGrid, IonRow, IonCol,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner,
  IonBadge,
} from '@ionic/react';
import ApiService, { UserSecret } from '../services/Api';
import AppHeader from '../components/shell/AppHeader';
import FormRenderer from '../components/forms/FormRenderer';
import { ComponentResults } from '../interfaces/types';
import { USER_PROFILE_FORM } from '../constants';
import { useAuth } from '../contexts/AuthContext';

const formatDate = (val: string) => {
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString();
};

const Account: React.FC = () => {
  const { user } = useAuth();

  // ── change password ──────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwError, setPwError]       = useState('');
  const [pwSuccess, setPwSuccess]   = useState(false);
  const [pwSaving, setPwSaving]     = useState(false);

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError('New passwords do not match'); return; }
    if (newPw.length < 8)    { setPwError('New password must be at least 8 characters'); return; }
    setPwSaving(true);
    try {
      await ApiService.changePassword(currentPw, newPw);
      setPwSuccess(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e: any) {
      setPwError(e.message ?? 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  // ── profile (form-driven; in this app the CV identity block) ──────────────────
  const [profileForm, setProfileForm] = useState<ComponentResults | null>(null);
  const [profileData, setProfileData] = useState<Record<string, any>>({});
  const [profileMsg, setProfileMsg]   = useState('');

  useEffect(() => {
    ApiService.getComponentByName(USER_PROFILE_FORM).then(f => setProfileForm((f ?? null) as ComponentResults | null));
    ApiService.getUserProfile().then(p => setProfileData(p?.data ?? {}));
  }, []);

  const handleSaveProfile = async (values: any) => {
    setProfileMsg('');
    const saved = await ApiService.upsertUserProfile(values);
    setProfileData(saved?.data ?? values);
    setProfileMsg('Identity saved. It applies to every CV on next compile.');
  };

  // ── integrations (user_secrets keychain — set/clear only, never read back) ────
  const [secrets, setSecrets]           = useState<UserSecret[]>([]);
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [secretBusy, setSecretBusy]     = useState<string | null>(null);
  const [secretError, setSecretError]   = useState('');

  const loadSecrets = async () => {
    setSecrets(await ApiService.getUserSecrets());
  };

  useEffect(() => { loadSecrets(); }, []);

  const handleSaveSecret = async (name: string) => {
    const value = (secretInputs[name] ?? '').trim();
    if (!value) return;
    setSecretError('');
    setSecretBusy(name);
    try {
      await ApiService.setUserSecret(name, value);
      setSecretInputs(prev => ({ ...prev, [name]: '' }));
      await loadSecrets();
    } catch (e: any) {
      setSecretError(e.message ?? 'Failed to save key');
    } finally {
      setSecretBusy(null);
    }
  };

  const handleClearSecret = async (name: string) => {
    setSecretError('');
    setSecretBusy(name);
    try {
      await ApiService.clearUserSecret(name);
      await loadSecrets();
    } catch (e: any) {
      setSecretError(e.message ?? 'Failed to clear key');
    } finally {
      setSecretBusy(null);
    }
  };

  return (
    <IonPage>
      <AppHeader />

      <IonContent fullscreen>
        <IonGrid>
          <IonRow>
            <IonCol size="12" sizeMd="6" offsetMd="3">

              {/* ── Account info ──────────────────────────────────── */}
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>Account</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonItem lines="full">
                    <IonLabel>
                      <p style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>Email</p>
                      <p>{user?.email}</p>
                    </IonLabel>
                  </IonItem>
                  <IonItem lines="full">
                    <IonLabel>
                      <p style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>Role</p>
                      <p style={{ textTransform: 'capitalize' }}>{user?.role}</p>
                    </IonLabel>
                  </IonItem>
                </IonCardContent>
              </IonCard>

              {/* ── Profile ───────────────────────────────────────── */}
              <IonCard style={{ marginTop: 12 }}>
                <IonCardHeader>
                  <IonCardTitle>Profile</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonItem lines="none">
                    <IonLabel style={{ whiteSpace: 'normal', fontSize: 13, color: 'var(--ion-color-medium)' }}>
                      Name, contact and links used on every CV you build. Only the per-CV tagline is set in the CV builder.
                    </IonLabel>
                  </IonItem>
                  {profileMsg && <IonItem lines="none"><IonText color="success" style={{ fontSize: 13 }}>{profileMsg}</IonText></IonItem>}
                  {profileForm && (
                    <FormRenderer
                      component={profileForm}
                      defaultValues={profileData}
                      onSubmit={handleSaveProfile}
                      submitLabel="Save Identity"
                    />
                  )}
                </IonCardContent>
              </IonCard>

              {/* ── Integrations ──────────────────────────────────── */}
              <IonCard style={{ marginTop: 12 }}>
                <IonCardHeader>
                  <IonCardTitle>Integrations</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonItem lines="none">
                    <IonLabel style={{ whiteSpace: 'normal', fontSize: 13, color: 'var(--ion-color-medium)' }}>
                      API keys are stored encrypted and used only by the server. Once saved, a key is never shown again — only its last four characters.
                    </IonLabel>
                  </IonItem>
                  {secretError && <IonItem lines="none"><IonText color="danger" style={{ fontSize: 13 }}>{secretError}</IonText></IonItem>}
                  {secrets.map(s => (
                    <React.Fragment key={s.name}>
                      <IonItem lines="none">
                        <IonLabel>
                          <p style={{ fontWeight: 500 }}>{s.label}</p>
                          {s.isSet && (
                            <p style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>
                              ····{s.last4}{s.updated_at ? ` · updated ${formatDate(s.updated_at)}` : ''}
                            </p>
                          )}
                        </IonLabel>
                        <IonBadge slot="end" color={s.isSet ? 'success' : 'medium'}>
                          {s.isSet ? 'Set' : 'Not set'}
                        </IonBadge>
                      </IonItem>
                      <IonItem lines="full">
                        <IonInput
                          label={s.isSet ? 'Replace key' : 'Add key'}
                          labelPlacement="stacked"
                          type="password"
                          value={secretInputs[s.name] ?? ''}
                          onIonInput={e => setSecretInputs(prev => ({ ...prev, [s.name]: e.detail.value ?? '' }))}
                        />
                        <IonButton
                          slot="end" size="small"
                          disabled={secretBusy === s.name || !(secretInputs[s.name] ?? '').trim()}
                          onClick={() => handleSaveSecret(s.name)}
                        >
                          {secretBusy === s.name ? <IonSpinner name="dots" /> : 'Save'}
                        </IonButton>
                        {s.isSet && (
                          <IonButton
                            slot="end" size="small" fill="clear" color="danger"
                            disabled={secretBusy === s.name}
                            onClick={() => handleClearSecret(s.name)}
                          >
                            Clear
                          </IonButton>
                        )}
                      </IonItem>
                    </React.Fragment>
                  ))}
                </IonCardContent>
              </IonCard>

              {/* ── Change password ───────────────────────────────── */}
              <IonCard style={{ marginTop: 12 }}>
                <IonCardHeader>
                  <IonCardTitle>Change Password</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  {pwError   && <IonItem lines="none"><IonText color="danger">{pwError}</IonText></IonItem>}
                  {pwSuccess && <IonItem lines="none"><IonText color="success">Password changed successfully.</IonText></IonItem>}
                  <IonItem lines="full">
                    <IonInput label="Current password" labelPlacement="stacked" type="password"
                      value={currentPw} onIonInput={e => setCurrentPw(e.detail.value ?? '')} />
                  </IonItem>
                  <IonItem lines="full">
                    <IonInput label="New password" labelPlacement="stacked" type="password"
                      value={newPw} onIonInput={e => setNewPw(e.detail.value ?? '')} />
                  </IonItem>
                  <IonItem lines="full">
                    <IonInput label="Confirm new password" labelPlacement="stacked" type="password"
                      value={confirmPw} onIonInput={e => setConfirmPw(e.detail.value ?? '')} />
                  </IonItem>
                  <IonButton expand="block" style={{ marginTop: 16 }}
                    disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                    onClick={handleChangePassword}
                  >
                    {pwSaving ? <IonSpinner name="dots" /> : 'Update Password'}
                  </IonButton>
                </IonCardContent>
              </IonCard>

            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default Account;
