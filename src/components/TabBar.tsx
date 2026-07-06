/**
 * TabBar — custom bottom tab bar for the (tabs) group: Home / Journey / Stats / Profile.
 * Styled to match the design (surface fill, top hairline, active = primary, inactive = text3).
 * The OS renders the real home indicator, so we pad by the bottom safe-area inset instead of
 * drawing the prototype's fake pill.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Home', icon: 'tabHome' },
  journey: { label: 'Journey', icon: 'tabMap' },
  stats: { label: 'Stats', icon: 'tabChart' },
  profile: { label: 'Profile', icon: 'tabUser' },
};

/** The subset of expo-router's bottom-tab `tabBar` props we use (kept permissive so the
 *  real BottomTabBarProps passed by expo-router stays assignable). */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit: (event: any) => any;
  };
};

export function TabBar({ state, navigation }: TabBarProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: t.surface,
          borderTopColor: t.border,
          paddingBottom: 6 + insets.bottom,
        },
      ]}>
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const color = focused ? t.primary : t.text3;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.item}>
            <Icon name={meta.icon} size={23} color={color} />
            <Text style={[styles.label, { color }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 9,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: Font.nunito800,
    fontSize: 10.5,
  },
});
