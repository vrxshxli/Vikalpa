import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, space, touch, type } from '@/theme';
import { Eyebrow } from '@/components/primitives';

/** A ruled line on the page rather than a boxed input. */
export function Field({ label, style, ...rest }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: space(4) }}>
      <Eyebrow color={focused ? colors.indigo : colors.inkFaint}>{label}</Eyebrow>
      <TextInput
        {...rest}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        placeholderTextColor={colors.inkFaint}
        style={[styles.input, { borderBottomColor: focused ? colors.indigo : colors.ruleStrong }, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    ...type.body,
    color: colors.ink,
    minHeight: touch.min,
    paddingVertical: space(2.5),
    borderBottomWidth: 1.5,
  },
});
