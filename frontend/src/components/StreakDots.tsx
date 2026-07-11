/**
 * StreakDots — the last seven local days, one dot each. Filled means a quiz was finished
 * that day; the outlined dot is today, still open.
 *
 * The days come from the server's `stats.daily` series, which is bucketed in the device's
 * timezone — so the dot labelled "today" is the day the learner is actually living in.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { StatsDay } from '@/lib/api';
import { Radius } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

import { Appear } from './Appear';
import { Sym } from './Sym';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * `date` is a bare local calendar day ("2026-07-10"). `new Date(that)` parses it as UTC
 * midnight, which lands on the previous day for anyone west of Greenwich — so build the
 * date from its parts instead.
 */
function weekdayInitial(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return WEEKDAY[new Date(year, month - 1, day).getDay()];
}

export function StreakDots({ days }: { days: StatsDay[] }) {
  const t = useTokens();
  // The series is oldest-first and always seven long; the last entry is today.
  const todayIndex = days.length - 1;

  return (
    <View style={styles.row}>
      {days.map((day, i) => {
        const done = day.quizzes > 0;
        const isToday = i === todayIndex;
        return (
          <Appear key={day.date} delay={i * 40} duration={220}>
            <View
              style={styles.col}
              accessible
              accessibilityLabel={`${weekdayInitial(day.date)}${isToday ? ', today' : ''}, ${
                done ? `${day.quizzes} finished` : 'nothing finished'
              }`}
            >
              <View
                style={[
                  styles.dot,
                  done
                    ? { backgroundColor: t.accent }
                    : {
                        backgroundColor: t.fill,
                        borderWidth: isToday ? 2 : 0,
                        borderColor: t.accent,
                      },
                ]}
              >
                {done && <Sym name="checkmark" size={12} color={t.onAccent} weight="bold" />}
              </View>
              <Text style={[Type.caption, { color: isToday ? t.text : t.text3 }]}>
                {weekdayInitial(day.date)}
              </Text>
            </View>
          </Appear>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { alignItems: 'center', gap: 6 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
