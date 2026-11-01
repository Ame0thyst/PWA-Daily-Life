/**
 * analytics.js — Comprehensive Analytics Dashboard
 * Features:
 *  - GitHub-style 53-week Activity & Mood Heatmap (Always visible & interactive)
 *  - Primary Overview Grid (Streak, Total Entries, Average Mood, Words Count)
 *  - Mood Distribution Breakdown (5 levels with percentage bars)
 *  - Writing Rhythm & Habit Insights (Favorite time, most active day, avg length, photos)
 *  - Interactive Daily Mood Trend Chart (Chart.js with theme-adaptive styling)
 *  - Popular Topics & Tags Ranking
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
    <div class="flex flex-col gap-5 pb-32 max-w-xl mx-auto">
      <!-- Header with Time Filter -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Statistik & Wawasan</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">Pantau ritme refleksi, kebiasaan menulis, dan suasana hatimu.</p>
        </div>
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

      <!-- Quick Metrics 4-Card Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <!-- Streak -->
        <div class="modern-card p-4 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Streak</span>
            <span class="text-base">🔥</span>
          </div>
          <div class="mt-2">
            <p id="metric-streak" class="font-bold text-2xl text-gray-900 dark:text-white">0 <span class="text-xs font-normal text-gray-400">hari</span></p>
            <p id="metric-longest-streak" class="text-[10px] text-gray-400 mt-0.5">Terpanjang: 0 hari</p>
          </div>
        </div>

        <!-- Total Entri -->
        <div class="modern-card p-4 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Entri</span>
            <span class="text-base">📖</span>
          </div>
          <div class="mt-2">
            <p id="metric-total" class="font-bold text-2xl text-gray-900 dark:text-white">0</p>
            <p id="metric-period-entries" class="text-[10px] text-gray-400 mt-0.5">Dalam periode ini: 0</p>
          </div>
        </div>

        <!-- Rata-rata Mood -->
        <div class="modern-card p-4 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Rata-rata</span>
            <span class="text-base">😊</span>
          </div>
          <div class="mt-2">
            <p id="metric-avg-mood" class="font-bold text-2xl text-gray-900 dark:text-white">-</p>
            <p id="metric-avg-label" class="text-[10px] text-gray-400 mt-0.5">Belum ada skor</p>
          </div>
        </div>

        <!-- Total Kata -->
        <div class="modern-card p-4 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Kata</span>
            <span class="text-base">✍️</span>
          </div>
          <div class="mt-2">
            <p id="metric-total-words" class="font-bold text-2xl text-gray-900 dark:text-white">0</p>
            <p id="metric-avg-words" class="text-[10px] text-gray-400 mt-0.5">Rata-rata: 0 kata/entri</p>
          </div>
        </div>
      </div>

      <!-- Activity Heatmap Section (GitHub-style 53-week grid) -->
      <section class="flex flex-col gap-2">
        <div id="analytics-heatmap-container"></div>
      </section>

      <!-- Mood Distribution Breakdown -->
      <section class="modern-card p-5">
        <div class="flex items-center justify-between mb-3.5">
          <div class="flex items-center gap-2">
            <span class="flex size-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 text-sm">📊</span>
            <div>
              <h3 class="text-sm font-bold text-gray-900 dark:text-white leading-tight">Distribusi Suasana Hati</h3>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">Komposisi emosi yang kamu rasakan</p>
            </div>
          </div>
          <span id="mood-dist-total-count" class="text-xs font-semibold text-gray-400">0 Entri</span>
        </div>
        <div id="mood-distribution-container" class="flex flex-col gap-2.5">
          <!-- Filled dynamically -->
        </div>
      </section>

      <!-- Writing Rhythm & Habit Insights -->
      <section class="modern-card p-5">
        <div class="flex items-center gap-2 mb-4">
          <span class="flex size-7 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 text-sm">💡</span>
          <div>
            <h3 class="text-sm font-bold text-gray-900 dark:text-white leading-tight">Wawasan Kebiasaan Menulis</h3>
            <p class="text-[11px] text-gray-500 dark:text-gray-400">Pola dan ritme catatan pribadimu</p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Waktu Favorit -->
          <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 flex items-start gap-3">
            <span id="habit-time-icon" class="text-2xl mt-0.5">🌙</span>
            <div>
              <p class="text-[11px] font-semibold text-gray-400 uppercase">Waktu Favorit Menulis</p>
              <p id="habit-time-title" class="text-sm font-bold text-gray-900 dark:text-white mt-0.5">-</p>
              <p id="habit-time-desc" class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Mencatat cerita secara konsisten</p>
            </div>
          </div>

          <!-- Hari Teraktif -->
          <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 flex items-start gap-3">
            <span class="text-2xl mt-0.5">📅</span>
            <div>
              <p class="text-[11px] font-semibold text-gray-400 uppercase">Hari Paling Produktif</p>
              <p id="habit-day-title" class="text-sm font-bold text-gray-900 dark:text-white mt-0.5">-</p>
              <p id="habit-day-desc" class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Hari paling banyak menuangkan cerita</p>
            </div>
          </div>

          <!-- Rata-rata Kedalaman -->
          <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 flex items-start gap-3">
            <span class="text-2xl mt-0.5">📝</span>
            <div>
              <p class="text-[11px] font-semibold text-gray-400 uppercase">Gaya Catatan</p>
              <p id="habit-style-title" class="text-sm font-bold text-gray-900 dark:text-white mt-0.5">-</p>
              <p id="habit-style-desc" class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Berdasarkan panjang tulisanmu</p>
            </div>
          </div>

          <!-- Momen Visual -->
          <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 flex items-start gap-3">
            <span class="text-2xl mt-0.5">📸</span>
            <div>
              <p class="text-[11px] font-semibold text-gray-400 uppercase">Koleksi Momen Foto</p>
              <p id="habit-photo-count" class="text-sm font-bold text-gray-900 dark:text-white mt-0.5">0 Foto</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Memori visual yang tersimpan aman</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Mood Trend Chart Section -->
      <section class="modern-card p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="flex size-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-sm">📈</span>
            <div>
              <h3 class="text-sm font-bold text-gray-900 dark:text-white leading-tight">Tren Suasana Hati Harian</h3>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">Pergerakan emosimu dari hari ke hari</p>
            </div>
          </div>
        </div>
        <div class="relative h-56 w-full">
          <canvas id="mood-trend-chart"></canvas>
        </div>
      </section>

      <!-- Top Tags Section -->
      <section class="modern-card p-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="flex size-7 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-sm">🏷️</span>
          <div>
            <h3 class="text-sm font-bold text-gray-900 dark:text-white leading-tight">Topik & Tag Terpopuler</h3>
            <p class="text-[11px] text-gray-500 dark:text-gray-400">Kata kunci yang paling sering kamu bahas</p>
          </div>
        </div>
        <div id="top-tags-container" class="flex flex-col gap-2.5">
          <p class="text-xs text-gray-400">Belum ada tag yang digunakan.</p>
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

  // Load data from IndexedDB
  const entries = await getAllEntries();
  updateAnalyticsData(entries);

  // Background sync if online
  if (navigator.onLine) {
    apiGetStats().catch(() => {});
  }
}

function updateAnalyticsData(entries) {
  const streakEl = document.getElementById('metric-streak');
  const longestStreakEl = document.getElementById('metric-longest-streak');
  const totalEl = document.getElementById('metric-total');
  const periodEntriesEl = document.getElementById('metric-period-entries');
  const avgMoodEl = document.getElementById('metric-avg-mood');
  const avgLabelEl = document.getElementById('metric-avg-label');
  const totalWordsEl = document.getElementById('metric-total-words');
  const avgWordsEl = document.getElementById('metric-avg-words');

  if (!entries || entries.length === 0) {
    if (streakEl) streakEl.innerHTML = `0 <span class="text-xs font-normal text-gray-400">hari</span>`;
    if (totalEl) totalEl.textContent = '0';
    if (avgMoodEl) avgMoodEl.textContent = '-';
    if (totalWordsEl) totalWordsEl.textContent = '0';
    renderHeatmap('analytics-heatmap-container', []);
    renderEmptyStates();
    return;
  }

  // Calculate Streak (Current & Longest)
  const streakInfo = calculateStreak(entries);
  if (streakEl) streakEl.innerHTML = `${streakInfo.current} <span class="text-xs font-normal text-gray-400">hari</span>`;
  if (longestStreakEl) longestStreakEl.textContent = `Terpanjang: ${streakInfo.longest} hari`;

  // Filter entries within selected period
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - currentPeriodDays);
  const periodEntries = entries.filter((e) => new Date(e.timestamp) >= cutoff);

  // Total Entries
  if (totalEl) totalEl.textContent = String(entries.length);
  if (periodEntriesEl) periodEntriesEl.textContent = `Dalam ${currentPeriodDays} hari: ${periodEntries.length}`;

  // Average Mood
  const validMoods = periodEntries.filter((e) => e.mood).map((e) => e.mood);
  const moodIcons = ['', '😞', '🙁', '😐', '🙂', '😄'];
  const moodLabels = ['', 'Perlu Istirahat', 'Kurang Bersemangat', 'Biasa & Santai', 'Positif & Baik', 'Sangat Bahagia'];

  if (validMoods.length > 0) {
    const avg = (validMoods.reduce((a, b) => a + b, 0) / validMoods.length).toFixed(1);
    const roundedAvg = Math.max(1, Math.min(5, Math.round(parseFloat(avg))));
    if (avgMoodEl) avgMoodEl.textContent = `${avg} ${moodIcons[roundedAvg] || ''}`;
    if (avgLabelEl) avgLabelEl.textContent = moodLabels[roundedAvg] || 'Kondisi stabil';
  } else {
    if (avgMoodEl) avgMoodEl.textContent = '-';
    if (avgLabelEl) avgLabelEl.textContent = 'Belum ada catatan';
  }

  // Habits & Writing Analysis
  const habits = calculateHabits(periodEntries.length > 0 ? periodEntries : entries);
  if (totalWordsEl) totalWordsEl.textContent = habits.totalWords.toLocaleString('id-ID');
  if (avgWordsEl) avgWordsEl.textContent = `Rata-rata: ${habits.avgWords} kata/entri`;

  // Update Habit Cards
  updateHabitCardsUI(habits);

  // Render Mood Distribution Breakdown
  renderMoodDistribution(periodEntries.length > 0 ? periodEntries : entries);

  // Render Heatmap (Full 1-Year activity)
  renderHeatmap('analytics-heatmap-container', entries, () => {
    window.location.hash = '#/timeline';
  });

  // Render Mood Trend Chart
  renderChart(periodEntries);

  // Render Top Tags
  const tagsContainer = document.getElementById('top-tags-container');
  renderTopTags(periodEntries.length > 0 ? periodEntries : entries, tagsContainer);
}

function calculateStreak(entries) {
  if (entries.length === 0) return { current: 0, longest: 0 };

  const uniqueDates = Array.from(
    new Set(entries.map((e) => e.timestamp.substring(0, 10)))
  ).sort();

  // Longest streak
  let longest = 0;
  let currentRun = 0;
  let prevDate = null;

  for (const dateStr of uniqueDates) {
    const d = new Date(dateStr);
    if (!prevDate) {
      currentRun = 1;
    } else {
      const diff = Math.round((d - prevDate) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        currentRun += 1;
      } else {
        currentRun = 1;
      }
    }
    if (currentRun > longest) longest = currentRun;
    prevDate = d;
  }

  // Current streak
  const descDates = [...uniqueDates].reverse();
  const todayStr = new Date().toISOString().substring(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().substring(0, 10);

  let current = 0;
  if (descDates[0] === todayStr || descDates[0] === yesterdayStr) {
    let expected = new Date(descDates[0]);
    for (const dateStr of descDates) {
      const actual = new Date(dateStr);
      const diffDays = Math.round((expected - actual) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        current += 1;
        expected.setDate(expected.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return { current, longest: Math.max(longest, current) };
}

function calculateHabits(entries) {
  const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  let totalWords = 0;
  let totalPhotos = 0;

  entries.forEach((e) => {
    if (e.text) {
      const words = e.text.trim().split(/\s+/).filter(Boolean).length;
      totalWords += words;
    }
    if (e.thumb || e.imageHD || e.fileId) {
      totalPhotos += 1;
    }

    const d = new Date(e.timestamp);
    const hour = d.getHours();
    const day = d.getDay();
    dayCounts[day] += 1;

    if (hour >= 5 && hour < 11) {
      timeSlots.morning += 1;
    } else if (hour >= 11 && hour < 15) {
      timeSlots.afternoon += 1;
    } else if (hour >= 15 && hour < 18) {
      timeSlots.evening += 1;
    } else {
      timeSlots.night += 1;
    }
  });

  const avgWords = Math.round(totalWords / Math.max(1, entries.length));

  // Determine top time slot
  const slotList = [
    { key: 'Malam (18:00 - 04:00)', count: timeSlots.night, icon: '🌙', desc: 'Refleksi tenang penutup hari' },
    { key: 'Pagi (05:00 - 11:00)', count: timeSlots.morning, icon: '🌅', desc: 'Awal hari yang segar & fokus' },
    { key: 'Siang (11:00 - 15:00)', count: timeSlots.afternoon, icon: '☀️', desc: 'Jeda catatan di tengah hari' },
    { key: 'Sore (15:00 - 18:00)', count: timeSlots.evening, icon: '🌇', desc: 'Momen santai sore hari' },
  ].sort((a, b) => b.count - a.count);

  const topTimeSlot = slotList[0].count > 0 ? slotList[0] : { key: 'Belum terdata', icon: '⏰', desc: 'Teruslah mencatat ceritamu' };

  // Determine top day
  let maxDayIndex = 0;
  dayCounts.forEach((c, idx) => {
    if (c > dayCounts[maxDayIndex]) maxDayIndex = idx;
  });
  const topDay = dayCounts[maxDayIndex] > 0 ? dayNames[maxDayIndex] : '-';
  const topDayEntries = dayCounts[maxDayIndex];

  // Writing style determination
  let styleTitle = 'Catatan Ringkas';
  let styleDesc = 'Pencatatan momen cepat & to the point (< 50 kata)';
  if (avgWords >= 150) {
    styleTitle = 'Reflektif & Mendalam';
    styleDesc = `Tulisan kaya narasi (${avgWords} kata/entri)`;
  } else if (avgWords >= 50) {
    styleTitle = 'Seimbang & Cerita';
    styleDesc = `Deskripsi runtut & teratur (${avgWords} kata/entri)`;
  }

  return {
    topTimeSlot,
    topDay,
    topDayEntries,
    totalWords,
    avgWords,
    totalPhotos,
    styleTitle,
    styleDesc,
  };
}

function updateHabitCardsUI(habits) {
  const timeIconEl = document.getElementById('habit-time-icon');
  const timeTitleEl = document.getElementById('habit-time-title');
  const timeDescEl = document.getElementById('habit-time-desc');

  const dayTitleEl = document.getElementById('habit-day-title');
  const dayDescEl = document.getElementById('habit-day-desc');

  const styleTitleEl = document.getElementById('habit-style-title');
  const styleDescEl = document.getElementById('habit-style-desc');

  const photoCountEl = document.getElementById('habit-photo-count');

  if (timeIconEl) timeIconEl.textContent = habits.topTimeSlot.icon;
  if (timeTitleEl) timeTitleEl.textContent = habits.topTimeSlot.key;
  if (timeDescEl) timeDescEl.textContent = habits.topTimeSlot.desc;

  if (dayTitleEl) dayTitleEl.textContent = habits.topDay;
  if (dayDescEl) {
    dayDescEl.textContent = habits.topDay !== '-'
      ? `${habits.topDayEntries} catatan ditulis pada hari ${habits.topDay}`
      : 'Belum cukup data hari';
  }

  if (styleTitleEl) styleTitleEl.textContent = habits.styleTitle;
  if (styleDescEl) styleDescEl.textContent = habits.styleDesc;

  if (photoCountEl) photoCountEl.textContent = `${habits.totalPhotos} Foto Tersimpan`;
}

function renderMoodDistribution(entries) {
  const container = document.getElementById('mood-distribution-container');
  const totalCountEl = document.getElementById('mood-dist-total-count');
  if (!container) return;

  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalWithMood = 0;

  entries.forEach((e) => {
    if (e.mood && counts[e.mood] !== undefined) {
      counts[e.mood] += 1;
      totalWithMood += 1;
    }
  });

  if (totalCountEl) totalCountEl.textContent = `${totalWithMood} Entri`;

  if (totalWithMood === 0) {
    container.innerHTML = `<p class="text-xs text-gray-400">Belum ada catatan mood dalam rentang waktu ini.</p>`;
    return;
  }

  const moodItems = [
    { level: 5, emoji: '😄', label: 'Sangat Baik', barClass: 'bg-emerald-500', count: counts[5] },
    { level: 4, emoji: '🙂', label: 'Baik', barClass: 'bg-emerald-400', count: counts[4] },
    { level: 3, emoji: '😐', label: 'Biasa Saja', barClass: 'bg-amber-400', count: counts[3] },
    { level: 2, emoji: '🙁', label: 'Kurang Baik', barClass: 'bg-orange-400', count: counts[2] },
    { level: 1, emoji: '😞', label: 'Sangat Buruk', barClass: 'bg-rose-500', count: counts[1] },
  ];

  container.innerHTML = moodItems
    .map((item) => {
      const pct = Math.round((item.count / totalWithMood) * 100);
      return `
        <div class="flex items-center gap-3 text-xs">
          <div class="flex items-center gap-1.5 w-28 shrink-0">
            <span class="text-sm">${item.emoji}</span>
            <span class="font-medium text-gray-700 dark:text-gray-200 truncate">${item.label}</span>
          </div>
          <div class="flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800 h-3">
            <div class="h-full rounded-full ${item.barClass} transition-all duration-500" style="width: ${pct}%"></div>
          </div>
          <div class="w-14 text-right shrink-0">
            <span class="font-bold text-gray-900 dark:text-white">${pct}%</span>
            <span class="text-[10px] text-gray-400 ml-0.5">(${item.count})</span>
          </div>
        </div>
      `;
    })
    .join('');
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
    if (!e.timestamp || !e.mood) return;
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

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94A3B8' : '#6B7280';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const primaryColor = isDark ? '#FFFFFF' : '#181B20';

  const ctx = canvas.getContext('2d');

  activeChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Mood',
          data: dataValues,
          borderColor: primaryColor,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(24, 27, 32, 0.04)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: primaryColor,
          pointBorderColor: isDark ? '#171A21' : '#FFFFFF',
          pointBorderWidth: 2,
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
          backgroundColor: isDark ? '#1F2937' : '#181B20',
          titleColor: '#FFFFFF',
          bodyColor: '#E5E7EB',
          padding: 10,
          cornerRadius: 12,
          displayColors: false,
          callbacks: {
            label: (item) => {
              const moodIcons = ['', '😞 Sangat Buruk', '🙁 Kurang Baik', '😐 Biasa', '🙂 Baik', '😄 Sangat Baik'];
              const rounded = Math.round(item.raw);
              return `Mood: ${item.raw} / 5 (${moodIcons[rounded] || ''})`;
            },
          },
        },
      },
      scales: {
        y: {
          min: 1,
          max: 5,
          ticks: {
            stepSize: 1,
            color: textColor,
            font: { size: 11 },
            callback: (val) => ['', '😞', '🙁', '😐', '🙂', '😄'][val] || val,
          },
          grid: {
            color: gridColor,
            drawBorder: false,
          },
        },
        x: {
          ticks: {
            color: textColor,
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
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
      const cleanTag = t.trim().replace(/^#/, '');
      if (cleanTag) {
        tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
      }
    });
  });

  const sorted = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (sorted.length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-400">Belum ada hashtag yang digunakan dalam periode ini.</p>`;
    return;
  }

  const maxCount = sorted[0][1];

  container.innerHTML = sorted
    .map(([tag, count]) => {
      const pct = Math.max(10, Math.round((count / maxCount) * 100));
      return `
        <div class="flex items-center gap-3 text-xs">
          <span class="w-28 truncate font-medium text-gray-800 dark:text-gray-200">#${tag}</span>
          <div class="flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800 h-2.5">
            <div class="h-full rounded-full bg-gray-900 dark:bg-gray-100 transition-all duration-300" style="width: ${pct}%"></div>
          </div>
          <span class="w-8 text-right font-semibold text-gray-400">${count}x</span>
        </div>
      `;
    })
    .join('');
}

function renderEmptyStates() {
  const moodContainer = document.getElementById('mood-distribution-container');
  if (moodContainer) {
    moodContainer.innerHTML = `<p class="text-xs text-gray-400">Belum ada catatan.</p>`;
  }
}
