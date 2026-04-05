import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { apiClient } from '@monevo/core';
import { useThemeColors } from '../../../src/theme/ThemeContext';
import { spacing, typography, radius } from '../../../src/theme/tokens';
import {
  groupEventsByDate,
  formatEventDate,
} from '../../../src/types/economic-calendar';
import type { CalendarEvent, FilterOption } from '../../../src/types/economic-calendar';
import { EventCard } from '../../../src/components/tools/calendar/EventCard';
import { FilterChips } from '../../../src/components/tools/calendar/FilterChips';
import { CalendarSkeleton } from '../../../src/components/tools/calendar/CalendarSkeleton';

export default function EconomicCalendarScreen() {
  const c = useThemeColors();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await (apiClient as any).get('/economic-calendar/');
      const data: CalendarEvent[] = res.data ?? [];
      setEvents(data);
      setError(null);
    } catch {
      setError('Could not load calendar events.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchEvents();
  }, [fetchEvents]);

  const filtered = filter === 'all' ? events : events.filter((e) => e.impact === filter);
  const sections = groupEventsByDate(filtered);

  if (loading) return <CalendarSkeleton />;

  return (
    <>
      <Stack.Screen options={{ title: 'Economic Calendar' }} />
      <SectionList
        style={[styles.root, { backgroundColor: c.bg }]}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.eventWrapper}>
            <EventCard event={item} />
          </View>
        )}
        renderSectionHeader={({ section: { date } }) => (
          <View style={[styles.sectionHeader, { backgroundColor: c.bg }]}>
            <Text style={[styles.sectionDate, { color: c.textMuted }]}>
              {formatEventDate(date)}
            </Text>
          </View>
        )}
        ListHeaderComponent={
          <FilterChips active={filter} onChange={setFilter} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {error ? (
              <>
                <Text style={[styles.emptyIcon]}>📅</Text>
                <Text style={[styles.emptyTitle, { color: c.text }]}>No events loaded</Text>
                <Text style={[styles.emptyBody, { color: c.textMuted }]}>{error}</Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={[styles.emptyTitle, { color: c.text }]}>No events</Text>
                <Text style={[styles.emptyBody, { color: c.textMuted }]}>
                  No {filter !== 'all' ? filter + '-impact' : ''} events this period.
                </Text>
              </>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  listContent: { paddingBottom: spacing.xxxxl },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  sectionDate: {
    fontSize: typography.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventWrapper: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  empty: {
    padding: spacing.xxxxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: typography.lg, fontWeight: '700' },
  emptyBody: { fontSize: typography.sm, textAlign: 'center', lineHeight: 20 },
});
