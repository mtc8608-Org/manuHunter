// Menu — the hamburger slide-out drawer.
// - Links to every major section of the app
// - Shows the logged-in user's name and email
// - Logout button
import {
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonNote,
} from '@ionic/react';

import { useLocation } from 'react-router-dom';
import {
  clipboardOutline,
  documentTextOutline,
  constructOutline, folderOutline,
  personOutline, peopleOutline, logOutOutline,
  homeOutline, briefcaseOutline,
  downloadOutline, layersOutline,
  keyOutline, settingsOutline,
} from 'ionicons/icons';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTE } from '../../constants';
import './Menu.css';

const Menu: React.FC = () => {
  const location = useLocation();
  const { user, isAdmin, isUser, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const navItem = (url: string, iosIcon: string, label: string) => (
    <IonMenuToggle key={url} autoHide={false}>
      <IonItem
        className={location.pathname === url ? 'selected' : ''}
        routerLink={url}
        routerDirection="none"
        lines="none"
        detail={false}
      >
        <IonIcon aria-hidden="true" slot="start" icon={iosIcon} />
        <IonLabel>{label}</IonLabel>
      </IonItem>
    </IonMenuToggle>
  );

  return (
    <IonMenu contentId="main" type="overlay">
      <IonContent>

        <IonList id="inbox-list">
          <IonListHeader>Navigation</IonListHeader>
          {user && <IonNote>{user.email}</IonNote>}
          {navItem(ROUTE.LANDING, homeOutline, 'Home')}
        </IonList>

        <IonList>
          <IonListHeader>Job Applications</IonListHeader>
          {navItem(ROUTE.APPLICATIONS, briefcaseOutline, 'Applications')}
          {navItem(ROUTE.ARTIFACTS, folderOutline, 'Artifacts')}
        </IonList>

        <IonList>
          <IonListHeader>CV Builder</IonListHeader>
          {navItem(ROUTE.CV, documentTextOutline, 'CVs')}
          {navItem(ROUTE.GENERATED_CVS, downloadOutline, 'Generated CVs')}
          {navItem(ROUTE.CV_TEMPLATES, layersOutline, 'Templates')}
        </IonList>

        {isUser && (
          <IonList>
            <IonListHeader>Surveys</IonListHeader>
            {navItem(ROUTE.SURVEYS, clipboardOutline, 'Surveys')}
          </IonList>
        )}

        {isAdmin && (
          <IonList>
            <IonListHeader>Backoffice</IonListHeader>
            {navItem(ROUTE.CONTENT,       documentTextOutline, 'Content')}
            {navItem(ROUTE.FILES,         folderOutline,       'Files')}
            {navItem(ROUTE.CONFIGURATION, constructOutline,    'Configuration')}
            {navItem(ROUTE.USERS,         peopleOutline,       'Users')}
          </IonList>
        )}

        <IonList id="labels-list">
          <IonListHeader>Account</IonListHeader>
          {navItem(ROUTE.PROFILE,  personOutline,   'Profile')}
          {navItem(ROUTE.ACCOUNT,  keyOutline,      'Account')}
          {navItem(ROUTE.SETTINGS, settingsOutline, 'Settings')}

          {user && (
            <IonItem lines="none" button detail={false} onClick={handleLogout}>
              <IonIcon aria-hidden="true" slot="start" icon={logOutOutline} />
              <IonLabel>Logout</IonLabel>
            </IonItem>
          )}
        </IonList>

      </IonContent>
    </IonMenu>
  );
};

export default Menu;
