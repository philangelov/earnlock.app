import { useRouter } from 'expo-router';

import { HoursDial } from '@/components/onboarding/HoursDial';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { voice } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';

export default function ScreenTimeStep() {
  const router = useRouter();
  const hoursPerDay = useEarnLock((s) => s.hoursPerDay);
  const setHoursPerDay = useEarnLock((s) => s.setHoursPerDay);
  const estimateHoursPerDay = useEarnLock((s) => s.estimateHoursPerDay);
  const usage = useEarnLock((s) => s.usage);
  const name = useEarnLock((s) => s.name);

  const v = voice(usage, name);
  const next = () => router.push('/onboarding/pace');

  return (
    <OnboardingStep
      step="screentime"
      title={v.hoursTitle}
      subtitle="A rough guess is fine — Screen Time gives us the real number later."
      onBack={() => router.back()}
      onCta={next}
      ghostLabel="I don’t know"
      onGhost={() => {
        // Falls back to the average, and flags it so the reveal doesn't pass our figure off
        // as theirs.
        estimateHoursPerDay();
        next();
      }}
      center
    >
      <HoursDial value={hoursPerDay} onChange={setHoursPerDay} />
    </OnboardingStep>
  );
}
