import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Path, Line, Circle } from 'react-native-svg';
import { colors, radius, spacing, typography } from '../../theme';

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  barColor?: string;
  style?: ViewStyle;
}

export const SimpleBarChart: React.FC<BarChartProps> = ({
  data,
  height = 120,
  barColor = colors.primaryOrange,
  style,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }, style]}>
        <Text style={styles.emptyText}>No telemetry history available</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartWidth = 280;
  const barWidth = Math.min(24, Math.floor((chartWidth - data.length * 8) / data.length));

  return (
    <View style={[styles.chartCard, style]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        {/* Baseline */}
        <Line
          x1={0}
          y1={height - 20}
          x2={chartWidth}
          y2={height - 20}
          stroke={colors.borderLight}
          strokeWidth={1}
        />

        {data.map((item, idx) => {
          const barHeight = ((item.value / maxValue) * (height - 40));
          const x = idx * (chartWidth / data.length) + (chartWidth / data.length - barWidth) / 2;
          const y = height - 20 - barHeight;

          return (
            <React.Fragment key={idx}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 4)}
                rx={4}
                fill={barColor}
              />
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={styles.labelsRow}>
        {data.map((item, idx) => (
          <Text key={idx} style={styles.barLabel} numberOfLines={1}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
};

export const SimpleTrendLine: React.FC<{
  data: number[];
  height?: number;
  color?: string;
  style?: ViewStyle;
}> = ({ data, height = 60, color = colors.primaryOrange, style }) => {
  if (!data || data.length < 2) return null;

  const width = 200;
  const min = Math.min(...data);
  const max = Math.max(...data, min + 1);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - 10 - ((val - min) / range) * (height - 20);
    return { x, y };
  });

  const pathD = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  return (
    <View style={style}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={pathD} stroke={color} strokeWidth={2.5} fill="none" />
        {points.map((p, idx) => (
          <Circle key={idx} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: colors.cardLight,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardLight,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textDarkMuted,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.xs,
  },
  barLabel: {
    fontSize: 9,
    color: colors.textDarkMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
});
