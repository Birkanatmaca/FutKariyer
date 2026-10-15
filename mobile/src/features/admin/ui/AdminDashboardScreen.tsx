import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Building,
  ClipboardCheck,
  Newspaper,
  Users,
} from 'lucide-react-native';
import { Brand } from '../../../shared/ui/Brand';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import type { AdminServices } from '../application/admin-services';
import { useResource } from '../application/hooks';
import { AdminMenu, type AdminDestination } from './AdminMenu';
import { Metric, SectionTitle, adminStyles } from './parts/AdminParts';

const text = copy.admin.dashboard;

export function AdminDashboardScreen({
  services,
  name,
  onOpen,
}: {
  services: AdminServices;
  name: string;
  onOpen(destination: AdminDestination): void;
}) {
  const load = useCallback(async () => {
    const [applications, reviews, users, clubs] = await Promise.all([
      services.applications.countPending(),
      services.content.pendingReviews().then(items => items.length),
      services.accounts.list('users', 1, '').then(page => page.total),
      services.accounts.list('clubs', 1, '').then(page => page.total),
    ]);
    return { applications, reviews, users, clubs };
  }, [services]);
  const counts = useResource(load);
  const { refresh } = counts;
  const first = React.useRef(true);
  // Counts follow decisions made in other tabs.
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const value = (count: number | undefined) =>
    counts.loading || count === undefined ? '—' : count.toLocaleString('tr-TR');
  return (
    <Screen>
      <Brand />
      <View style={styles.hero}>
        <View style={styles.glow} pointerEvents="none" />
        <Text style={styles.eyebrow}>{text.eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.name}>
          {text.greeting(name.split(' ')[0] || name)}
        </Text>
        <Text style={styles.body}>{text.body}</Text>
      </View>
      <View style={adminStyles.metrics}>
        <Metric
          label={text.pendingApplications}
          value={value(counts.data?.applications)}
          icon={ClipboardCheck}
        />
        <Metric
          label={text.pendingReviews}
          value={value(counts.data?.reviews)}
          icon={Newspaper}
        />
        <Metric
          label={text.users}
          value={value(counts.data?.users)}
          icon={Users}
        />
        <Metric
          label={text.clubs}
          value={value(counts.data?.clubs)}
          icon={Building}
        />
      </View>
      {counts.error ? (
        <>
          <ErrorBanner message={counts.error} />
          <Button label={copy.form.retry} secondary onPress={counts.retry} />
        </>
      ) : null}
      <SectionTitle title={text.sections} />
      <AdminMenu
        onOpen={onOpen}
        badges={{
          applications: counts.data?.applications,
          reviews: counts.data?.reviews,
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: space.xl,
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.layer,
  },
  glow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.brandWash,
  },
  eyebrow: { ...type.eyebrow, color: colors.brand },
  name: { ...type.display, fontSize: 30, lineHeight: 36, color: colors.text },
  body: { ...type.body, color: colors.secondary },
});
