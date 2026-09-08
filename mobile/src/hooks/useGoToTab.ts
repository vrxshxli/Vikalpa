/**
 * Switching destinations.
 *
 * Goes through the navigator's own `navigate(routeName)` — the same call the tab
 * bar makes — and keeps the href form as a fallback for callers mounted outside
 * the tab navigator.
 */
import { useCallback } from 'react';
import { router, useNavigation } from 'expo-router';

export type TabName = 'journey' | 'intelligence' | 'recover' | 'profile' | 'history';

export function useGoToTab() {
  const navigation = useNavigation();

  return useCallback(
    (name: TabName) => {
      const nav = navigation as unknown as {
        navigate?: (target: string) => void;
        getParent?: () => { navigate?: (target: string) => void } | undefined;
      };

      if (typeof nav.navigate === 'function') {
        nav.navigate(name);
        return;
      }
      const parent = nav.getParent?.();
      if (typeof parent?.navigate === 'function') {
        parent.navigate(name);
        return;
      }
      router.navigate(`/${name}` as never);
    },
    [navigation],
  );
}
