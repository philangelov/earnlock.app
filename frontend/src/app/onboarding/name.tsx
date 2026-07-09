import { useRouter } from 'expo-router';

import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { TextField } from '@/components/TextField';
import { voice } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';

export default function NameStep() {
  const router = useRouter();
  const name = useEarnLock((s) => s.name);
  const setName = useEarnLock((s) => s.setName);
  const usage = useEarnLock((s) => s.usage);

  const v = voice(usage, '');
  const ready = name.trim().length >= 2;
  const next = () => router.push('/onboarding/greeting');

  return (
    <OnboardingStep
      step="name"
      title={v.nameTitle}
      subtitle={v.nameSubtitle}
      onBack={() => router.back()}
      ctaDisabled={!ready}
      onCta={next}
      center
      avoidKeyboard
    >
      <TextField
        value={name}
        onChangeText={setName}
        placeholder={v.namePlaceholder}
        autoFocus
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        maxLength={24}
        enablesReturnKeyAutomatically
        onSubmitEditing={() => ready && next()}
      />
    </OnboardingStep>
  );
}
