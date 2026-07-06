import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Font } from '@/theme/tokens';
import { useEarnLock } from '@/store/useEarnLock';

export default function WakeUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const resetQuizFlow = useEarnLock((s) => s.resetQuizFlow);

  const startQuiz = () => {
    resetQuizFlow();
    router.push('/quiz');
  };

  return (
    <LinearGradient
      colors={['#2a2b78', '#6a5cf0', '#a97ce0', '#f0a9b8', '#ffd9a8']}
      locations={[0, 0.34, 0.6, 0.82, 1]}
      style={styles.gradient}>
      <StatusBar style="light" />
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 2, paddingBottom: insets.bottom + 22 },
        ]}>
        <View style={styles.sun} />

        <Text style={styles.time}>07:30</Text>
        <Text style={styles.greeting}>Good morning</Text>
        <Text style={styles.subtitle}>
          Social apps are locked. Answer 3 quick questions to start scrolling.
        </Text>

        <View style={styles.badge}>
          <Icon name="lockSolid" size={16} color="#fff" />
          <Text style={styles.badgeText}>3 questions to unlock</Text>
        </View>

        <View style={styles.spacer} />

        <Pressable
          onPress={startQuiz}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonLabel}>Start morning quiz</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  sun: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#ffd27a',
    marginTop: 24,
    shadowColor: '#ffcf66',
    shadowOpacity: 0.8,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  time: {
    fontFamily: Font.baloo800,
    fontSize: 64,
    color: '#fff',
    marginTop: 26,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  greeting: {
    fontFamily: Font.baloo700,
    fontSize: 24,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Font.nunito700,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.94)',
    marginTop: 16,
    maxWidth: 280,
    textAlign: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 7,
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  badgeText: {
    fontFamily: Font.nunito800,
    fontSize: 13.5,
    color: '#fff',
  },
  spacer: { flex: 1 },
  button: {
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  buttonPressed: { transform: [{ scale: 0.97 }] },
  buttonLabel: {
    fontFamily: Font.baloo800,
    fontSize: 17.5,
    color: '#5a4fd6',
  },
});
