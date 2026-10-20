import { useCallback, useEffect, useState } from 'react';
import {
  createAuthService,
  authRepository,
  useAdminAuth,
  LoginScreen,
  RecoveryCodesScreen,
} from '../features/auth';
import {
  createAdminService,
  adminRepository,
  AdminPanel,
  ClubOverviewPanel,
} from '../features/admin';
import {
  ContentPanel,
  createContentService,
  contentRepository,
} from '../features/content';
import {
  PopupPanel,
  createPopupService,
  popupRepository,
} from '../features/popups';
import {
  LeaguesPanel,
  createLeagueService,
  leagueRepository,
} from '../features/leagues';
import {
  PaymentsPanel,
  createPaymentService,
  paymentsRepository,
} from '../features/payments';
import {
  GiftsPanel,
  createGiftService,
  giftsRepository,
} from '../features/gifts';
import {
  RatingPanel,
  createRatingService,
  ratingRepository,
} from '../features/rating';
import {
  AuditPanel,
  auditRepository,
  createAuditService,
} from '../features/audit';
import {
  AnnouncementsPanel,
  createAnnouncementService,
  announcementsRepository,
} from '../features/announcements';
import {
  ApplicationsPanel,
  createApplicationService,
  applicationsRepository,
} from '../features/applications';
import {
  ReportsPanel,
  createReportsService,
  reportsRepository,
} from '../features/reports';
import { AdminLayout } from './AdminLayout';
import { Brand } from '../shared/ui/Brand';
import { Button } from '../shared/ui/Button';
import { copy } from '../shared/lib/copy';
import { useAdminRoute } from './useAdminRoute';
const authService = createAuthService(authRepository);
const adminService = createAdminService(adminRepository);
const contentService = createContentService(contentRepository);
// Popup images use the same content image store as banner ads.
const popupService = createPopupService(popupRepository, contentService);
const leagueService = createLeagueService(leagueRepository);
const paymentService = createPaymentService(paymentsRepository);
const giftService = createGiftService(giftsRepository);
const ratingService = createRatingService(ratingRepository);
const auditService = createAuditService(auditRepository);
const announcementService = createAnnouncementService(announcementsRepository);
const applicationService = createApplicationService(applicationsRepository);
const reportsService = createReportsService(reportsRepository);

export function App() {
  const auth = useAdminAuth(authService);
  const { route, clubId, navigate, openClubOverview } = useAdminRoute();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [pendingApplications, setPendingApplications] = useState(0);
  const [openReports, setOpenReports] = useState(0);
  const userId = auth.user?.id;
  useEffect(() => {
    if (!userId) {
      setPendingApplications(0);
      setOpenReports(0);
      return;
    }
    let current = true;
    applicationService
      .countPending()
      .then(count => {
        if (current) setPendingApplications(count);
      })
      .catch(() => undefined);
    reportsService
      .countOpen()
      .then(count => {
        if (current) setOpenReports(count);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [userId]);
  const updatePendingApplications = useCallback(
    (count: number) => setPendingApplications(count),
    [],
  );
  useEffect(() => {
    if (auth.user && route === 'login') {
      navigate('users', true);
    }
    if (
      !auth.loading &&
      !auth.user &&
      route !== 'missing' &&
      route !== 'login'
    ) {
      navigate('login', true);
    }
  }, [auth.user, auth.loading, route, navigate]);
  async function logout() {
    if (logoutBusy) {
      return;
    }
    setLogoutBusy(true);
    setLogoutError(null);
    try {
      await auth.logout();
      navigate('login', true);
    } catch (failure) {
      setLogoutError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setLogoutBusy(false);
    }
  }
  if (route === 'missing') {
    return (
      <main className="startup">
        <Brand />
        <h1>{copy.notFound.title}</h1>
        <Button onClick={() => navigate('login')}>{copy.notFound.back}</Button>
      </main>
    );
  }
  if (auth.loading) {
    return (
      <main className="startup">
        <Brand />
        <p role="status">{copy.form.loading}</p>
      </main>
    );
  }
  if (!auth.user) {
    return (
      <LoginScreen
        onLogin={auth.login}
        serviceError={auth.error}
        onRetry={auth.retry}
        challenge={auth.challenge}
        onVerify={auth.verify}
        onCancelChallenge={auth.cancelChallenge}
      />
    );
  }
  if (auth.recoveryCodes.length) {
    return (
      <RecoveryCodesScreen
        codes={auth.recoveryCodes}
        onDone={auth.acknowledgeRecoveryCodes}
      />
    );
  }
  const section =
    route === 'club-overview' ||
    route === 'clubs' ||
    route === 'applications' ||
    route === 'reports' ||
    route === 'ads' ||
    route === 'popups' ||
    route === 'news' ||
    route === 'leagues' ||
    route === 'payments' ||
    route === 'gifts' ||
    route === 'rating' ||
    route === 'announcements' ||
    route === 'audit'
      ? route === 'club-overview'
        ? 'clubs'
        : route
      : 'users';
  return (
    <AdminLayout
      section={section}
      onSection={navigate}
      user={auth.user}
      onLogout={logout}
      logoutBusy={logoutBusy}
      logoutError={logoutError}
      badges={{ applications: pendingApplications, reports: openReports }}
    >
      {route === 'club-overview' && clubId ? (
        <ClubOverviewPanel
          key={clubId}
          service={adminService}
          id={clubId}
          onBack={() => navigate('clubs')}
        />
      ) : section === 'ads' || section === 'news' ? (
        <ContentPanel
          key={section}
          section={section}
          service={contentService}
        />
      ) : section === 'popups' ? (
        <PopupPanel service={popupService} />
      ) : section === 'applications' ? (
        <ApplicationsPanel
          service={applicationService}
          onPendingCount={updatePendingApplications}
        />
      ) : section === 'reports' ? (
        <ReportsPanel service={reportsService} onOpenCount={setOpenReports} />
      ) : section === 'leagues' ? (
        <LeaguesPanel service={leagueService} />
      ) : section === 'payments' ? (
        <PaymentsPanel service={paymentService} />
      ) : section === 'gifts' ? (
        <GiftsPanel service={giftService} />
      ) : section === 'rating' ? (
        <RatingPanel service={ratingService} />
      ) : section === 'audit' ? (
        <AuditPanel service={auditService} />
      ) : section === 'announcements' ? (
        <AnnouncementsPanel service={announcementService} />
      ) : (
        <AdminPanel
          key={auth.user.id}
          service={adminService}
          section={section}
          logoutBusy={logoutBusy}
          onOpenClub={openClubOverview}
        />
      )}
    </AdminLayout>
  );
}
