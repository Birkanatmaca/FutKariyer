import React from 'react';
import { MessagesSquare } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
export function ConnectionsScreen({ onDiscover }: { onDiscover(): void }) {
  return (
    <Screen>
      <PageHeader
        eyebrow={copy.connections.eyebrow}
        title={copy.connections.title}
        description={copy.connections.description}
      />
      <EmptyState
        icon={MessagesSquare}
        title={copy.connections.emptyTitle}
        body={copy.connections.emptyBody}
      />
      <Button label={copy.connections.button} onPress={onDiscover} secondary />
    </Screen>
  );
}
