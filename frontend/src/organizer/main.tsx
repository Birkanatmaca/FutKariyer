import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OrganizerApp } from './OrganizerApp';
import '../styles/tokens.css';
import '../styles/app.css';

// The organizer web area at /organizasyon (22 Oct 2026): a separate entry
// page of the admin build, signed in with an organizer bearer session.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OrganizerApp />
  </StrictMode>,
);
