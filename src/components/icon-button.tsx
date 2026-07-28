import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radii } from '@/theme/tokens';

interface IconButtonProps extends ComponentProps<typeof Pressable> {
  icon: ReactNode;
  label: string;
  selected?: boolean;
}

export function IconButton({
  icon,
  label,
  selected = false,
  style,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        selected && styles.selected,
        pressed && styles.pressed,
        typeof style === 'function' ? style({ pressed, hovered: false }) : style,
      ]}
      {...props}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
  },
  selected: {
    backgroundColor: colors.mint,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
