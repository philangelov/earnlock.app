import { Stack } from 'expo-router';

import { Logo } from '@/components/Logo';
import { tabStackOptions } from '@/theme/navTheme';
import { useTokens } from '@/theme/theme';

export default function TodayLayout() {
  const t = useTokens();
  return (
    <Stack screenOptions={tabStackOptions(t)}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Today',
          // The mark belongs on the home screen, but not competing with the dial for it.
          // In the bar it rides beside the large title and shrinks away with it on scroll.
          headerRight: () => <Logo size={26} color={t.text3} />,
        }}
      />
    </Stack>
  );
}
