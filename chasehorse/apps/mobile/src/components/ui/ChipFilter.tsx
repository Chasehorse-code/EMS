import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export interface ChipOption<T = string> {
  id: T;
  label: string;
  count?: number;
  icon?: string;
}

interface ChipFilterProps<T = string> {
  options: ChipOption<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
  style?: ViewStyle;
}

export function ChipFilter<T = string>({
  options,
  selectedId,
  onSelect,
  style,
}: ChipFilterProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, style]}
    >
      {options.map((opt) => {
        const isSelected = opt.id === selectedId;
        return (
          <TouchableOpacity
            key={String(opt.id)}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(opt.id)}
            activeOpacity={0.8}
          >
            {opt.icon && <Text style={styles.chipIcon}>{opt.icon}</Text>}
            <Text
              style={[
                styles.chipLabel,
                isSelected && styles.chipLabelSelected,
              ]}
            >
              {opt.label}
            </Text>
            {opt.count !== undefined && (
              <View
                style={[
                  styles.countBadge,
                  isSelected && styles.countBadgeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    isSelected && styles.countTextSelected,
                  ]}
                >
                  {opt.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.primaryBlack,
    borderColor: colors.primaryBlack,
  },
  chipIcon: {
    marginRight: spacing.xs,
    fontSize: 13,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.textDarkSecondary,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: '#F3F1EB',
  },
  countBadge: {
    backgroundColor: colors.surfaceSunken || '#EBE7DE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
    marginLeft: spacing.xs,
  },
  countBadgeSelected: {
    backgroundColor: colors.primaryOrange,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
  },
  countTextSelected: {
    color: '#F3F1EB',
  },
});
