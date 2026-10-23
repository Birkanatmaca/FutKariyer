import { Linking } from 'react-native';
import { apiUrl } from '../api/client';
import { config } from './config';

// The server publishes the legal pages (backend/internal/platform/legal);
// the app opens them in the browser so the text has one source.
export const legalPages = {
  terms: '/kullanim-sartlari',
  privacy: '/gizlilik',
  kvkk: '/kvkk',
} as const;
export type LegalPage = keyof typeof legalPages;

export function openLegal(page: LegalPage) {
  return Linking.openURL(apiUrl(legalPages[page]));
}

export function supportAvailable() {
  return !!config.supportEmail;
}

export function openSupport() {
  return Linking.openURL(
    'mailto:' +
      config.supportEmail +
      '?subject=' +
      encodeURIComponent('Fut Career destek'),
  );
}
