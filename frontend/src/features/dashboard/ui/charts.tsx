import { useMemo, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { copy } from '../../../shared/lib/copy';
import type { DashboardDay, DashboardSlice } from '../domain/models';
import {
  formatMoney,
  formatNumber,
  shortDate,
} from '../application/dashboard-service';

const text = copy.dashboard;

// Recharts draws with SVG attributes, which cannot read CSS variables, so
// the design tokens are read once from the stylesheet.
export function useColors() {
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    return {
      brand: token('--brand', '#b6f36a'),
      accent: token('--accent', '#55d7c4'),
      info: token('--info', '#74afff'),
      warning: token('--warning', '#f5bb52'),
      danger: token('--danger', '#ff6b72'),
      success: token('--success', '#53d68a'),
      text: token('--text', '#f4f7fa'),
      muted: token('--muted', '#7f8c99'),
      border: token('--border', '#2d3947'),
      surface: token('--surface', '#121922'),
      raised: token('--raised', '#1b2733'),
    };
  }, []);
}
type Colors = ReturnType<typeof useColors>;

function tooltip(colors: Colors) {
  return {
    contentStyle: {
      background: colors.raised,
      border: '1px solid ' + colors.border,
      borderRadius: 12,
      color: colors.text,
      fontSize: 12,
    },
    labelStyle: { color: colors.muted, marginBottom: 4 },
    itemStyle: { color: colors.text, padding: 0 },
    cursor: { fill: colors.border, opacity: 0.35 },
  };
}

function axes(colors: Colors) {
  const common = {
    stroke: colors.muted,
    tick: { fill: colors.muted, fontSize: 11 },
    tickLine: false,
    axisLine: false,
  };
  return {
    x: { ...common, dataKey: 'date', tickFormatter: shortDate, minTickGap: 16 },
    y: { ...common, width: 36, allowDecimals: false },
  };
}

export function ChartCard({
  title,
  children,
  wide = false,
  footer,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  return (
    <section className={'dash-card dash-chart' + (wide ? ' dash-wide' : '')}>
      <h2>{title}</h2>
      {children}
      {footer}
    </section>
  );
}

export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((value, index) => ({ index, value }));
  const id = 'spark-' + color.replace(/[^a-z0-9]/gi, '');
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart
        data={points}
        margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={'url(#' + id + ')'}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SignupsChart({ data }: { data: DashboardDay[] }) {
  const colors = useColors();
  const a = axes(colors);
  const series: [keyof DashboardDay, string, string][] = [
    ['players', text.series.players, colors.brand],
    ['coaches', text.series.coaches, colors.accent],
    ['clubs', text.series.clubs, colors.info],
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          {series.map(([key, , color]) => (
            <linearGradient
              key={key}
              id={'g-' + key}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid
          stroke={colors.border}
          strokeDasharray="3 6"
          vertical={false}
        />
        <XAxis {...a.x} />
        <YAxis {...a.y} />
        <Tooltip
          {...tooltip(colors)}
          labelFormatter={v => shortDate(String(v))}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: colors.muted }}
        />
        {series.map(([key, name, color]) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            name={name}
            stackId="signups"
            stroke={color}
            strokeWidth={2}
            fill={'url(#g-' + key + ')'}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CommunityChart({ data }: { data: DashboardDay[] }) {
  const colors = useColors();
  const a = axes(colors);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          stroke={colors.border}
          strokeDasharray="3 6"
          vertical={false}
        />
        <XAxis {...a.x} />
        <YAxis {...a.y} />
        <Tooltip
          {...tooltip(colors)}
          labelFormatter={v => shortDate(String(v))}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="posts"
          name={text.series.posts}
          stroke={colors.brand}
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="replies"
          name={text.series.replies}
          stroke={colors.accent}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="likes"
          name={text.series.likes}
          stroke={colors.warning}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data }: { data: DashboardDay[] }) {
  const colors = useColors();
  const a = axes(colors);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid
          stroke={colors.border}
          strokeDasharray="3 6"
          vertical={false}
        />
        <XAxis {...a.x} />
        <YAxis
          {...a.y}
          yAxisId="money"
          width={64}
          tickFormatter={v => formatMoney(Number(v))}
        />
        <YAxis {...a.y} yAxisId="orders" orientation="right" />
        <Tooltip
          {...tooltip(colors)}
          labelFormatter={v => shortDate(String(v))}
          formatter={(value, name) =>
            name === text.series.revenue
              ? formatMoney(Number(value))
              : formatNumber(Number(value))
          }
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar
          yAxisId="money"
          dataKey="revenueMinor"
          name={text.series.revenue}
          fill={colors.brand}
          radius={[6, 6, 0, 0]}
          maxBarSize={22}
        />
        <Line
          yAxisId="orders"
          type="monotone"
          dataKey="orders"
          name={text.series.orders}
          stroke={colors.info}
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function GamesChart({ data }: { data: DashboardDay[] }) {
  const colors = useColors();
  const a = axes(colors);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          stroke={colors.border}
          strokeDasharray="3 6"
          vertical={false}
        />
        <XAxis {...a.x} />
        <YAxis {...a.y} />
        <Tooltip
          {...tooltip(colors)}
          labelFormatter={v => shortDate(String(v))}
        />
        <Bar
          dataKey="gamePlays"
          name={text.series.gamePlays}
          fill={colors.accent}
          radius={[6, 6, 0, 0]}
          maxBarSize={18}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HealthChart({ data }: { data: DashboardDay[] }) {
  const colors = useColors();
  const a = axes(colors);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          stroke={colors.border}
          strokeDasharray="3 6"
          vertical={false}
        />
        <XAxis {...a.x} />
        <YAxis {...a.y} />
        <Tooltip
          {...tooltip(colors)}
          labelFormatter={v => shortDate(String(v))}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar
          dataKey="errors"
          name={text.series.errors}
          stackId="h"
          fill={colors.danger}
          maxBarSize={18}
        />
        <Bar
          dataKey="warnings"
          name={text.series.warnings}
          stackId="h"
          fill={colors.warning}
          radius={[6, 6, 0, 0]}
          maxBarSize={18}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data,
  label,
}: {
  data: DashboardSlice[];
  label: (key: string) => string;
}) {
  const colors = useColors();
  const palette = [
    colors.brand,
    colors.accent,
    colors.info,
    colors.warning,
    colors.danger,
    colors.success,
    colors.muted,
  ];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <p className="muted dash-empty">{text.charts.empty}</p>;
  return (
    <div className="dash-donut">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Tooltip
            {...tooltip(colors)}
            formatter={(value, name) => [
              formatNumber(Number(value)),
              label(String(name)),
            ]}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius={52}
            outerRadius={80}
            paddingAngle={2}
            stroke={colors.surface}
            strokeWidth={2}
          >
            {data.map((item, index) => (
              <Cell key={item.key} fill={palette[index % palette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <ul className="dash-legend">
        {data.map((item, index) => (
          <li key={item.key}>
            <span
              className="dash-dot"
              style={{ background: palette[index % palette.length] }}
            />
            <span>{label(item.key)}</span>
            <strong>{formatNumber(item.value)}</strong>
            <em>{Math.round((item.value / total) * 100)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HorizontalBars({
  data,
  label,
}: {
  data: DashboardSlice[];
  label: (key: string) => string;
}) {
  const colors = useColors();
  if (!data.length)
    return <p className="muted dash-empty">{text.charts.empty}</p>;
  const rows = data.map(item => ({ ...item, name: label(item.key) }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 30)}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fill: colors.muted, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip {...tooltip(colors)} />
        <Bar
          dataKey="value"
          name={text.stats.players}
          fill={colors.brand}
          radius={[0, 6, 6, 0]}
          maxBarSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
