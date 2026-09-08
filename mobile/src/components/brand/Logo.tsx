/**
 * The VIKALPA mark.
 *
 * A V that is also a check: a dashed coral arm — the plan that broke — and a
 * solid indigo arm rising out of it, the alternative that was found, with a
 * spark where the new path lands.
 *
 * This renders the supplied logo artwork itself (`assets/logo-mark.png`), not
 * a reconstruction of it, so the in-app mark and the launcher icon are the
 * same image. `assets/logo-source.png` is the untouched original; every asset
 * in the set is a crop and a scale of it, nothing redrawn.
 */
import React, { memo } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/theme';
import { Txt } from '@/components/primitives';

const MARK = require('../../../assets/logo-mark.png');

export const VikalpaMark = memo(function VikalpaMark({
  size = 40,
  /** Flatten to one colour — for a watermark or a disabled state. */
  mono,
  style,
}: {
  size?: number;
  mono?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style} importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Image
        source={MARK}
        style={{ width: size, height: size }}
        resizeMode="contain"
        // tintColor flattens every opaque pixel, which is exactly what a
        // single-colour treatment wants.
        tintColor={mono}
        accessible={false}
      />
    </View>
  );
});

/**
 * Mark plus wordmark, side by side. Used on the splash and the auth screens;
 * the running app shows a small mark and the wordmark in its masthead.
 */
export const VikalpaLockup = memo(function VikalpaLockup({
  size = 44,
  tagline,
  style,
}: {
  size?: number;
  tagline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ alignItems: 'center' }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.18 }}>
        <VikalpaMark size={size} />
        <Txt
          variant="h1"
          accessibilityRole="header"
          style={{
            fontFamily: fonts.display,
            fontSize: size * 0.62,
            letterSpacing: size * 0.1,
            color: colors.indigoDeep,
          }}
        >
          VIKALPA
        </Txt>
      </View>
      {tagline ? (
        <Txt variant="small" color={colors.inkMuted} style={{ marginTop: size * 0.2 }}>
          When plans change, find another way.
        </Txt>
      ) : null}
    </View>
  );
});
