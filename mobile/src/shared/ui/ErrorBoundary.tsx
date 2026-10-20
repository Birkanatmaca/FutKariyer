import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { Button } from './Button';
import { copy } from '../lib/copy';
import { reportError } from '../lib/crash-report';
import { colors, radius, space, type } from '../../styles/tokens';

type State = { failed: boolean };

// A render error shows a calm retry screen instead of a white app, and is
// reported to the server log.
export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  State
> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    reportError({
      error,
      fatal: true,
      componentStack: info.componentStack ?? undefined,
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.root} accessibilityRole="alert">
        <View style={styles.icon}>
          <TriangleAlert size={26} color={colors.warning} />
        </View>
        <Text style={styles.title}>{copy.crash.title}</Text>
        <Text style={styles.body}>{copy.crash.body}</Text>
        <Button
          label={copy.crash.retry}
          compact
          onPress={() => this.setState({ failed: false })}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xl,
    backgroundColor: colors.bg,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: {
    ...type.caption,
    color: colors.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
