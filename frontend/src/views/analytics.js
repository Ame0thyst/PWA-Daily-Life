/**
 * analytics.js — Analytics Dashboard with Heatmap, Chart.js Mood Trends, and Top Tags
 */
import { getAllEntries } from '../data/db.js';
import { renderHeatmap } from '../components/heatmap.js';
import { apiGetStats } from '../data/api.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

let activeChartInstance = null;
let currentPeriodDays = 30; // 30, 90, 365

export async function renderAnalyticsView(container) {
  container.innerHTML = `
    <div class="flex flex-col gap-5 pb-24 max-w-xl mx-auto">
      <!-- Header with Time Filter -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
        <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Analitik Jurnal</h2>
        <div class="flex items-center gap-1.5" role="group">
          <button type="button" data-period="30"
            class="period-filter-btn chip-pill ${currentPeriodDays === 30 ? 'chip-pill-active' : 'chip-pill-inactive'}">
            30 Hari
          </button>
          <button type="button" data-period="90"
            class="period-filter-btn chip-pill ${currentPeriodDays === 90 ? 'chip-pill-active' : 'chip-pill-inactive'}">
            90 Hari
          </button>
          <button type="button" data-period="365"
            class="period-filter-btn chip-pill ${currentPeriodDays === 365 ? 'chip-pill-active' : 'chip-pill-inactive'}">
            1 Tahun
          </button>
        </div>
      </div>

      <!-- Quick Metrics Cards -->
      <div class="grid grid-cols-3 gap-3">
        <div class="modern-card p-4 text-center">
          <span class="text-xs font-semibold text-gray-500 uppercase">Streak</span>
          <p id="metric-streak" class="mt-1 font-bold text-2xl text-gray-900 dark:text-white">0 <span class="text-xs font-normal text-gray-400">hari</span></p>
        </div>
        <div class="modern-card p-4 text-center">
          <span class="text-xs font-semibold text-gray-500 uppercase">Total Entri</span>
          <p id="metric-total" class="mt-1 font-bold text-2xl text-gray-900 dark:text-white">0</p>
        </div>
        <div class="modern-card p-4 text-center">
          <span class="text-xs font-semibold text-gray-500 uppercase">Rata-rata</span>
          <p id="metric-avg-mood" class="mt-1 font-bold text-2xl text-gray-900 dark:text-white">-</p>
        </div>
      </div>

      <!-- Activity Heatmap Section -->
      <section class="flex flex-col gap-2">
        <div id="analytics-heatmap-container"></div>
      </section>

      <!-- Mood Trend Chart Section -->
      <section class="modern-card p-5">
        <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-3">Tren Suasana Hati Harian</h3>
        <div class="relative h-52 w-full">
          <canvas id="mood-trend-chart"></canvas>
        </div>
      </section>

      <!-- Top Tags Section -->
      <section class="modern-card p-5">
        <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-3">Top Topik & Tag</h3>
        <div id="top-tags-container" class="flex flex-col gap-2.5">
          <p class="text-xs text-gray-500">Belum ada tag yang digunakan.</p>
        </div>
      </section>
    </div>
  `;

  // Attach period button events
  container.querySelectorAll('.period-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPeriodDays = parseInt(btn.dataset.period, 10);
      renderAnalyticsView(container);
    });
  });

  // Load data
  const entries = await getAllEntries();
  updateAnalyticsData(entries);

  // Optional background refresh via stats endpoint
  if (navigator.onLine) {
    apiGetStats().catch(() => {});
  }
}

function updateAnalyticsData(entries) {
  const streakEl = document.getElementById('metric-streak');
  const totalEl = document.getElementById('metric-total');
  const avgMoodEl = document.getElementById('metric-avg-mood');
  const tagsContainer = document.getElementById('top-tags-container');

  if (!entries || entries.length === 0) {
    if (streakEl) streakEl.innerHTML = `0 <span class="text-xs font-sans text-ink-muted">hari</span>`;
    if (totalEl) totalEl.textContent = '0';
    if (avgMoodEl) avgMoodEl.textContent = '-';
    renderHeatmap('analytics-heatmap-container', []);
    return;
  }

  // Calculate Streak
  const streak = calculateStreak(entries);
  if (streakEl) streakEl.innerHTML = `${streak} <span class="text-xs font-sans text-ink-muted">hari</span>`;

  // Filter entries within selected period
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - currentPeriodDays);
  const periodEntries = entries.filter((e) => new Date(e.timestamp) >= cutoff);

  if (totalEl) totalEl.textContent = String(entries.length);

  // Calculate Average Mood
  const validMoods = periodEntries.filter((e) => e.mood).map((e) => e.mood);
  if (validMoods.length > 0) {
    const avg = (validMoods.reduce((a, b) => a + b, 0) / validMoods.length).toFixed(1);
    const moodIcons = ['', '😞', '🙁', '😐', '🙂', '😄'];
    const roundedAvg = Math.round(parseFloat(avg));
    if (avgMoodEl) avgMoodEl.textContent = `${avg} ${moodIcons[roundedAvg] || ''}`;
  } else {
    if (avgMoodEl) avgMoodEl.textContent = '-';
  }

  // Render Heatmap
  renderHeatmap('analytics-heatmap-container', entries, (selectedDate) => {
    window.location.hash = `#/timeline`;
  });

  // Render Mood Trend Chart
  renderChart(periodEntries);

  // Render Top Tags
  renderTopTags(periodEntries, tagsContainer);
}

function calculateStreak(entries) {
  if (entries.length === 0) return 0;

  // Extract unique sorted date strings (YYYY-MM-DD)
  const uniqueDates = Array.from(
    new Set(entries.map((e) => e.timestamp.substring(0, 10)))
  ).sort().reverse();

  const todayStr = new Date().toISOString().substring(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().substring(0, 10);

  // If latest entry is neither today nor yesterday, streak is 0
  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 0;
  let expectedDate = new Date(uniqueDates[0]);

  for (const dateStr of uniqueDates) {
    const actualDate = new Date(dateStr);
    const diffDays = Math.round((expectedDate - actualDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      streak += 1;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function renderChart(entries) {
  const canvas = document.getElementById('mood-trend-chart');
  if (!canvas) return;

  if (activeChartInstance) {
    activeChartInstance.destroy();
    activeChartInstance = null;
  }

  // Aggregate daily average mood
  const dailyMap = new Map();
  entries.forEach((e) => {
    const d = e.timestamp.substring(0, 10);
    if (!dailyMap.has(d)) dailyMap.set(d, []);
    dailyMap.get(d).push(e.mood);
  });

  // Sort by date ascending
  const sortedDates = Array.from(dailyMap.keys()).sort();
  const labels = sortedDates.map((d) => {
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}`;
  });

  const dataValues = sortedDates.map((d) => {
    const arr = dailyMap.get(d);
    return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
  });

  const ctx = canvas.getContext('2d');
  const accentColor = '#A66A3F';
  const accentSoft = '#EBD8C6';

  activeChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Mood',
          data: dataValues,
          borderColor: accentColor,
          backgroundColor: 'rgba(166, 106, 63, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: accentColor,
          pointBorderColor: '#FFFDF8',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#3A3631',
          titleColor: '#FAF6EE',
          bodyColor: '#FAF6EE',
          padding: 8,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (item) => `Mood: ${item.raw} / 5`,
          },
        },
      },
      scales: {
        y: {
          min: 1,
          max: 5,
          ticks: {
            stepSize: 1,
            color: '#6B6559',
            font: { size: 11 },
            callback: (val) => ['', '😞', '🙁', '😐', '🙂', '😄'][val] || val,
          },
          grid: {
            color: '#E4D9C5',
            drawBorder: false,
          },
        },
        x: {
          ticks: {
            color: '#6B6559',
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 7,
          },
          grid: { display: false },
        },
      },
    },
  });
}

function renderTopTags(entries, container) {
  if (!container) return;

  const tagCounts = new Map();
  entries.forEach((e) => {
    const tags = Array.isArray(e.tags)
      ? e.tags
      : typeof e.tags === 'string'
      ? e.tags.split(',').filter(Boolean)
      : [];
    tags.forEach((t) => {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    });
  });

  const sorted = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (sorted.length === 0) {
    container.innerHTML = `<p class="text-xs text-ink-muted">Belum ada tag yang digunakan dalam periode ini.</p>`;
    return;
  }

  const maxCount = sorted[0][1];

  container.innerHTML = sorted
    .map(([tag, count]) => {
      const pct = Math.max(8, Math.round((count / maxCount) * 100));
      return `
        <div class="flex items-center gap-3 text-xs">
          <span class="w-24 truncate font-medium text-ink">${tag}</span>
          <div class="flex-1 overflow-hidden rounded-full bg-sand h-3">
            <div class="h-full rounded-full bg-accent transition-all duration-300" style="width: ${pct}%"></div>
          </div>
          <span class="w-6 text-right font-semibold text-ink-muted">${count}</span>
        </div>
      `;
    })
    .join('');
}
