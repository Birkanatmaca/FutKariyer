import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { Listing, ListingFilter } from '../domain/models';

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('tr-TR');

const filters: { value: ListingFilter; label: string }[] = [
  { value: '', label: copy.listings.filters.all },
  { value: 'amateur', label: copy.listings.filters.amateur },
  { value: 'professional', label: copy.listings.filters.professional },
  { value: 'halisaha', label: copy.listings.filters.halisaha },
];

export function ListingFilterBar({
  value,
  onChange,
}: {
  value: ListingFilter;
  onChange(value: ListingFilter): void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={copy.listings.filterLabel}
      style={styles.filters}
    >
      {filters.map(filter => {
        const selected = filter.value === value;
        return (
          <Pressable
            key={filter.label}
            accessibilityRole="tab"
            accessibilityLabel={filter.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(filter.value)}
            style={[styles.filter, selected && styles.filterSelected]}
          >
            <Text
              style={[styles.filterText, selected && styles.filterTextSelected]}
            >
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ListingCard({
  listing,
  onOpen,
}: {
  listing: Listing;
  onOpen(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listing.title + ', ' + listing.clubName}
      accessibilityHint={copy.listings.open}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={styles.club}>
          {listing.clubName}
        </Text>
        <Text numberOfLines={2} style={styles.title}>
          {listing.title}
        </Text>
        <Text style={styles.position}>
          {listing.position || copy.listings.noPosition}
        </Text>
        <View style={styles.metaRow}>
          <MapPin size={13} color={colors.muted} />
          <Text style={styles.meta}>
            {listing.district || copy.listings.noDistrict} ·{' '}
            {formatDate(listing.createdAt)}
          </Text>
        </View>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  filter: {
    minHeight: 38,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandWash,
  },
  filterText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  filterTextSelected: { color: colors.brand },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised },
  cardBody: { flex: 1, gap: space.xs },
  club: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  position: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
});
