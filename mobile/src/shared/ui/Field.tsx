import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { colors, radius, space } from '../../styles/tokens';
import { copy } from '../lib/copy';

type Props = TextInputProps & {
  label: string;
  icon?: LucideIcon;
  error?: string;
  password?: boolean;
  hint?: string;
};
export function Field({
  label,
  icon: Icon,
  error,
  password,
  hint,
  ...props
}: Props) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.control,
          focused && styles.focused,
          !!error && styles.invalid,
        ]}
      >
        {Icon ? (
          <Icon size={19} color={focused ? colors.brand : colors.muted} />
        ) : null}
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          style={styles.input}
          selectionColor={colors.brand}
          secureTextEntry={password && !visible}
          onFocus={event => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={event => {
            setFocused(false);
            props.onBlur?.(event);
          }}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              visible ? copy.form.hidePassword : copy.form.showPassword
            }
            hitSlop={12}
            onPress={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff size={20} color={colors.secondary} />
            ) : (
              <Eye size={20} color={colors.secondary} />
            )}
          </Pressable>
        )}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: space.sm },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    minHeight: 56,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: space.lg,
    color: colors.text,
    fontSize: 15,
  },
  focused: { borderColor: colors.brand },
  invalid: { borderColor: colors.danger },
  error: { fontSize: 12, lineHeight: 18, color: colors.danger },
  hint: { fontSize: 12, lineHeight: 18, color: colors.muted },
});
