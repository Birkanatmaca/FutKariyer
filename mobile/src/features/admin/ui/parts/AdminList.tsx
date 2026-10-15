import React from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Floodlight } from '../../../../shared/ui/Floodlight';
import { colors, space } from '../../../../styles/tokens';

// Full-screen list for admin sections: floodlight header, pull to refresh and
// "load more" in the footer. Same width and padding as the shared Screen.
export function AdminList<T>({
  items,
  renderItem,
  keyOf,
  header,
  footer,
  refreshing,
  onRefresh,
  onEndReached,
}: {
  items: T[];
  renderItem: ListRenderItem<T>;
  keyOf(item: T): string;
  header: React.ReactElement;
  footer?: React.ReactElement | null;
  refreshing: boolean;
  onRefresh(): void;
  onEndReached?(): void;
}) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <Floodlight />
      <FlatList
        data={items}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ListHeaderComponent={<View style={styles.header}>{header}</View>}
        ListFooterComponent={
          footer ? <View style={styles.footer}>{footer}</View> : null
        }
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        }
      />
    </SafeAreaView>
  );
}
function Separator() {
  return <View style={styles.separator} />;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.xl,
    paddingBottom: 120,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  header: { gap: space.xl, marginBottom: space.xl },
  footer: { marginTop: space.xl, gap: space.md },
  separator: { height: space.md },
});
