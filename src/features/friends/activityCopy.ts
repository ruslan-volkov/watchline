import type { Ionicons } from '@expo/vector-icons';

import type { FriendProfile } from './api';
import type { FriendLink } from './useFriends';

/** One line under a friend's name in the list. */
export function activityLine(watchingTitle: string | null, profile: FriendProfile | null): string {
  if (watchingTitle) return `Regarde ${watchingTitle}`;
  // Only claim something is hidden when they actually chose to hide it —
  // otherwise it reads as an accusation against a friend who simply has
  // nothing in progress.
  if (profile?.activity_visible === false) return 'Activité masquée';
  return 'Rien en cours';
}

export interface EmptyCopy {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}

/**
 * Why a friend's page has nothing to show. Four causes, four answers: no link
 * at all, a request still pending, a friend who hides their activity, and a
 * friend who hasn't tracked anything yet. The first three are about us, not
 * about them, and saying so is the difference between an explanation and a
 * dead end.
 */
export function emptyActivityCopy(link: FriendLink | undefined, name: string): EmptyCopy {
  if (!link) {
    return {
      icon: 'person-add-outline',
      title: 'Pas encore ami',
      message: `Ajoute ${name} pour voir son activité.`,
    };
  }
  if (link.relation !== 'friend') {
    return {
      icon: 'hourglass-outline',
      title: 'Demande en attente',
      message: 'Son activité apparaîtra dès que la demande sera acceptée.',
    };
  }
  if (link.profile?.activity_visible === false) {
    return {
      icon: 'eye-off-outline',
      title: 'Activité masquée',
      message: `${name} ne partage pas son activité.`,
    };
  }
  return {
    icon: 'film-outline',
    title: 'Rien pour l’instant',
    message: `${name} n’a encore rien ajouté à son suivi.`,
  };
}
