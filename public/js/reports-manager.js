/**
 * Reports & Analytics Manager
 * Handles global multi-event reporting and statistics visualization.
 * Strictly isolated from POS, cart and order logic.
 */

(function () {
    const currentYear = new Date().getFullYear();

    let reportsState = {
        activeTab: 'overview',
        overviewData: null,
        timelinePeriod: 'month',
        dateFilter: {
            preset: 'this_year',
            startDate: `${currentYear}-01-01`,
            endDate: `${currentYear}-12-31`,
            label: `Quest'anno (${currentYear})`
        },
        isLoading: false,
        lastUpdated: null
    };

    let eventsTableState = {
        sortKey: 'date',
        sortDirection: 'desc',
        rawList: [],
        filteredList: [],
        renderedCount: 0,
        pageSize: 10,
        isLoadingMore: false
    };

    let compareState = {
        event1Id: null,
        event2Id: 'none',
        event1Data: null,
        event2Data: null,
        isLoading: false
    };

    /**
     * Compute start date, end date and label for quick presets.
     */
    function computePresetDates(preset) {
        const now = new Date();
        const yyyy = now.getFullYear();

        if (preset === 'this_year') {
            return {
                start: `${yyyy}-01-01`,
                end: `${yyyy}-12-31`,
                label: `Quest'anno (${yyyy})`
            };
        } else if (preset === 'prev_year') {
            const prevY = yyyy - 1;
            return {
                start: `${prevY}-01-01`,
                end: `${prevY}-12-31`,
                label: `Anno ${prevY}`
            };
        } else if (preset === 'this_week') {
            const curr = new Date(now);
            const dayOfWeek = curr.getDay(); // 0 is Sunday
            const diffToMon = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
            const mon = new Date(curr);
            mon.setDate(curr.getDate() + diffToMon);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);

            const formatD = (d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            return {
                start: formatD(mon),
                end: formatD(sun),
                label: 'Questa Settimana'
            };
        } else if (preset === 'this_month') {
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const start = `${yyyy}-${mm}-01`;
            const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
            const end = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
            const monthName = now.toLocaleString('it-IT', { month: 'long' });
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            return {
                start,
                end,
                label: `Mese Corrente (${capitalizedMonth})`
            };
        } else if (preset === 'prev_month') {
            const prevMonthDate = new Date(yyyy, now.getMonth() - 1, 1);
            const pY = prevMonthDate.getFullYear();
            const pM = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
            const lastDay = new Date(pY, prevMonthDate.getMonth() + 1, 0).getDate();
            const start = `${pY}-${pM}-01`;
            const end = `${pY}-${pM}-${String(lastDay).padStart(2, '0')}`;
            const pMonthName = prevMonthDate.toLocaleString('it-IT', { month: 'long' });
            const capitalizedPMonth = pMonthName.charAt(0).toUpperCase() + pMonthName.slice(1);
            return {
                start,
                end,
                label: `Mese Scorso (${capitalizedPMonth})`
            };
        } else if (preset === 'last_30_days') {
            const past = new Date(now);
            past.setDate(past.getDate() - 30);
            const yyyyStart = past.getFullYear();
            const mmStart = String(past.getMonth() + 1).padStart(2, '0');
            const ddStart = String(past.getDate()).padStart(2, '0');
            const start = `${yyyyStart}-${mmStart}-${ddStart}`;

            const mmEnd = String(now.getMonth() + 1).padStart(2, '0');
            const ddEnd = String(now.getDate()).padStart(2, '0');
            const end = `${yyyy}-${mmEnd}-${ddEnd}`;
            return {
                start,
                end,
                label: 'Ultimi 30 giorni'
            };
        } else if (preset === 'last_3_months') {
            const past = new Date(now);
            past.setDate(past.getDate() - 90);
            const yyyyStart = past.getFullYear();
            const mmStart = String(past.getMonth() + 1).padStart(2, '0');
            const ddStart = String(past.getDate()).padStart(2, '0');
            const start = `${yyyyStart}-${mmStart}-${ddStart}`;

            const mmEnd = String(now.getMonth() + 1).padStart(2, '0');
            const ddEnd = String(now.getDate()).padStart(2, '0');
            const end = `${yyyy}-${mmEnd}-${ddEnd}`;
            return {
                start,
                end,
                label: 'Ultimi 3 mesi'
            };
        } else if (preset === 'last_6_months') {
            const past = new Date(now);
            past.setDate(past.getDate() - 180);
            const yyyyStart = past.getFullYear();
            const mmStart = String(past.getMonth() + 1).padStart(2, '0');
            const ddStart = String(past.getDate()).padStart(2, '0');
            const start = `${yyyyStart}-${mmStart}-${ddStart}`;

            const mmEnd = String(now.getMonth() + 1).padStart(2, '0');
            const ddEnd = String(now.getDate()).padStart(2, '0');
            const end = `${yyyy}-${mmEnd}-${ddEnd}`;
            return {
                start,
                end,
                label: 'Ultimi 6 mesi'
            };
        } else if (preset === 'all_time') {
            return {
                start: null,
                end: null,
                label: 'Tutto lo Storico'
            };
        }
        return { start: null, end: null, label: 'Personalizzato' };
    }

    /**
     * Hide 'Mese' button in chart timeframe selector if the range is within a single month.
     */
    function updateTimeframeSelectorVisibility() {
        const monthBtn = document.getElementById('rep-timeframe-btn-month');
        if (!monthBtn) return;

        const start = reportsState.dateFilter.startDate;
        const end = reportsState.dateFilter.endDate;

        let isSingleMonth = false;
        if (start && end) {
            const sParts = start.split('-').map(Number);
            const eParts = end.split('-').map(Number);
            if (sParts[0] === eParts[0] && sParts[1] === eParts[1]) {
                isSingleMonth = true;
            } else {
                const sDate = new Date(start + 'T00:00:00');
                const eDate = new Date(end + 'T00:00:00');
                const diffDays = Math.round((eDate - sDate) / (1000 * 60 * 60 * 24));
                if (diffDays <= 31) {
                    isSingleMonth = true;
                }
            }
        }

        if (isSingleMonth) {
            monthBtn.style.display = 'none';
            if (reportsState.timelinePeriod === 'month') {
                reportsState.timelinePeriod = 'day';
                const dayBtn = document.getElementById('rep-timeframe-btn-day');
                const weekBtn = document.getElementById('rep-timeframe-btn-week');
                if (dayBtn) dayBtn.classList.add('active');
                if (weekBtn) weekBtn.classList.remove('active');
                monthBtn.classList.remove('active');
            }
        } else {
            monthBtn.style.display = 'inline-block';
        }
    }

    /**
     * Update the Date Range filter button label in the header.
     */
    function updateDateFilterButtonLabel() {
        const btnText = document.getElementById('reports-daterange-btn-text');
        if (btnText) {
            btnText.innerText = reportsState.dateFilter.label || `Quest'anno (${currentYear})`;
        }
        updateTimeframeSelectorVisibility();
    }

    /**
     * Open Date Range Filter Modal.
     */
    function openReportsDateRangeModal() {
        const modal = document.getElementById('reports-daterange-modal');
        if (!modal) return;

        // Sync preset buttons active state
        const presetButtons = modal.querySelectorAll('.reports-preset-btn');
        presetButtons.forEach(btn => {
            if (btn.getAttribute('data-preset') === reportsState.dateFilter.preset) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Sync input fields
        const startInput = document.getElementById('rep-filter-start-date');
        const endInput = document.getElementById('rep-filter-end-date');
        if (startInput) startInput.value = reportsState.dateFilter.startDate || '';
        if (endInput) endInput.value = reportsState.dateFilter.endDate || '';

        modal.style.display = 'flex';
    }

    /**
     * Close Date Range Filter Modal.
     */
    function closeReportsDateRangeModal() {
        const modal = document.getElementById('reports-daterange-modal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Select a preset in the date range modal.
     */
    function selectReportsPreset(preset) {
        const modal = document.getElementById('reports-daterange-modal');
        if (!modal) return;

        const presetButtons = modal.querySelectorAll('.reports-preset-btn');
        presetButtons.forEach(btn => {
            if (btn.getAttribute('data-preset') === preset) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const computed = computePresetDates(preset);
        const startInput = document.getElementById('rep-filter-start-date');
        const endInput = document.getElementById('rep-filter-end-date');
        if (startInput) startInput.value = computed.start || '';
        if (endInput) endInput.value = computed.end || '';
    }

    /**
     * Triggered when custom date input values are manually modified.
     */
    function onCustomDateInputChanged() {
        const modal = document.getElementById('reports-daterange-modal');
        if (!modal) return;

        const presetButtons = modal.querySelectorAll('.reports-preset-btn');
        presetButtons.forEach(btn => btn.classList.remove('active'));
    }

    /**
     * Apply the selected Date Range Filter and reload data.
     */
    function applyReportsDateFilter() {
        const modal = document.getElementById('reports-daterange-modal');
        const startInput = document.getElementById('rep-filter-start-date');
        const endInput = document.getElementById('rep-filter-end-date');

        let activePreset = null;
        if (modal) {
            const activeBtn = modal.querySelector('.reports-preset-btn.active');
            if (activeBtn) activePreset = activeBtn.getAttribute('data-preset');
        }

        const startVal = startInput ? startInput.value.trim() : '';
        const endVal = endInput ? endInput.value.trim() : '';

        if (activePreset && activePreset !== 'custom') {
            const computed = computePresetDates(activePreset);
            reportsState.dateFilter.preset = activePreset;
            reportsState.dateFilter.startDate = computed.start;
            reportsState.dateFilter.endDate = computed.end;
            reportsState.dateFilter.label = computed.label;
        } else {
            // Custom Range
            if (startVal && endVal && startVal > endVal) {
                alert("La data di inizio non può essere successiva alla data di fine.");
                return;
            }

            reportsState.dateFilter.preset = 'custom';
            reportsState.dateFilter.startDate = startVal || null;
            reportsState.dateFilter.endDate = endVal || null;

            if (startVal && endVal) {
                const sParts = startVal.split('-');
                const eParts = endVal.split('-');
                reportsState.dateFilter.label = `${sParts[2]}/${sParts[1]}/${sParts[0]} - ${eParts[2]}/${eParts[1]}/${eParts[0]}`;
            } else if (startVal) {
                const sParts = startVal.split('-');
                reportsState.dateFilter.label = `Dal ${sParts[2]}/${sParts[1]}/${sParts[0]}`;
            } else if (endVal) {
                const eParts = endVal.split('-');
                reportsState.dateFilter.label = `Fino al ${eParts[2]}/${eParts[1]}/${eParts[0]}`;
            } else {
                reportsState.dateFilter.label = 'Tutto lo Storico';
            }
        }

        updateDateFilterButtonLabel();
        closeReportsDateRangeModal();
        loadReportsOverview();
    }

    /**
     * Switch view to Reports and load overview data.
     */
    async function openReportsView() {
        if (typeof showView === 'function') {
            const ok = await showView('reports');
            if (ok) {
                updateDateFilterButtonLabel();
                switchReportsTab('overview');
                loadReportsOverview();
            }
        }
    }

    /**
     * Return to home / sagra selector view.
     */
    function closeReportsView() {
        if (typeof showView === 'function') {
            showView('login');
        }
    }

    /**
     * Switch active tab in the left sidebar.
     * @param {string} tabName
     */
    function switchReportsTab(tabName) {
        reportsState.activeTab = tabName;

        const navItems = document.querySelectorAll('.reports-nav-item');
        navItems.forEach(item => {
            const tab = item.getAttribute('data-tab');
            if (tab === tabName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        const sections = document.querySelectorAll('.reports-tab-section');
        sections.forEach(sec => {
            if (sec.id === `reports-tab-${tabName}`) {
                sec.style.display = 'flex';
            } else {
                sec.style.display = 'none';
            }
        });

        if ((tabName === 'overview' || tabName === 'events') && !reportsState.overviewData && !reportsState.isLoading) {
            loadReportsOverview();
        } else if (tabName === 'events' && reportsState.overviewData) {
            renderEventsTabSection(reportsState.overviewData.sagras);
        }
    }

    /**
     * Switch timeframe for the Sales Wave Chart (day, week, month).
     */
    function changeReportsTimelinePeriod(period) {
        reportsState.timelinePeriod = period;

        const buttons = document.querySelectorAll('.reports-timeframe-btn');
        buttons.forEach(btn => {
            if (btn.getAttribute('data-period') === period) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (reportsState.overviewData && reportsState.overviewData.timeline) {
            renderSalesWaveChart(reportsState.overviewData.timeline, period);
        }
    }

    /**
     * Fetch global overview statistics from backend with active date range filter.
     */
    async function loadReportsOverview() {
        if (reportsState.isLoading) return;
        reportsState.isLoading = true;

        showLoadingOverlay();

        try {
            let url = '/api/reports/overview';
            const params = new URLSearchParams();
            if (reportsState.dateFilter.startDate) params.append('start_date', reportsState.dateFilter.startDate);
            if (reportsState.dateFilter.endDate) params.append('end_date', reportsState.dateFilter.endDate);

            const queryString = params.toString();
            if (queryString) url += `?${queryString}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to load report data');
            }

            reportsState.overviewData = data;
            reportsState.lastUpdated = new Date();

            renderOverviewSection(data);
        } catch (err) {
            console.error('Error loading reports overview:', err);
            renderOverviewError(err.message);
        } finally {
            reportsState.isLoading = false;
            hideLoadingOverlay();
        }
    }

    /**
     * Helper to show loading overlay.
     */
    function showLoadingOverlay() {
        let overlay = document.getElementById('reports-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'reports-loading-overlay';
            overlay.className = 'reports-loading-overlay';
            overlay.innerHTML = `
                <div class="reports-loading-spinner"></div>
                <div style="font-weight: 600; font-size: 0.95rem;">Caricamento resoconti...</div>
            `;
            const mainView = document.getElementById('view-reports');
            if (mainView) mainView.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }

    /**
     * Helper to hide loading overlay.
     */
    function hideLoadingOverlay() {
        const overlay = document.getElementById('reports-loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    /**
     * Escape HTML strings safely.
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Format currency amount in standard Italian locale.
     */
    function formatCurrency(amount) {
        const val = Number(amount) || 0;
        return `€\u00A0${val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    /**
     * Show custom tooltip for reports wave chart.
     */
    function showReportsChartTooltip(e, timeLabel, revenueText, orderText) {
        const tooltip = document.getElementById('reports-chart-tooltip');
        if (!tooltip) return;

        tooltip.innerHTML = `
            <div class="reports-tooltip-time">${escapeHtml(timeLabel)}</div>
            <div class="reports-tooltip-val">
                <span class="material-symbols-rounded">payments</span>
                <span>${revenueText}</span>
            </div>
            <div class="reports-tooltip-sub">
                <span class="material-symbols-rounded" style="font-size:14px;">receipt_long</span>
                <span>${orderText}</span>
            </div>
        `;

        const dot = e.target;
        const parent = tooltip.offsetParent || tooltip.parentElement;
        if (dot && parent) {
            const dotRect = dot.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();

            const left = dotRect.left - parentRect.left + (dotRect.width / 2);
            const top = dotRect.top - parentRect.top - 8;

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        }

        tooltip.classList.add('visible');
    }

    /**
     * Hide custom tooltip for reports wave chart.
     */
    function hideReportsChartTooltip() {
        const tooltip = document.getElementById('reports-chart-tooltip');
        if (tooltip) tooltip.classList.remove('visible');
    }

    /**
     * Fill continuous date intervals (days, weeks, months) with 0 revenue where no sales occurred.
     */
    function fillContinuousTimeline(timelineRaw, period) {
        if (!timelineRaw || timelineRaw.length === 0) return [];
        if (timelineRaw.length === 1) return timelineRaw;

        const map = new Map();
        timelineRaw.forEach(item => {
            map.set(item.time_key, item);
        });

        if (period === 'day') {
            const sortedKeys = timelineRaw.map(t => t.time_key).sort();
            const first = new Date(sortedKeys[0] + 'T00:00:00');
            const last = new Date(sortedKeys[sortedKeys.length - 1] + 'T00:00:00');
            const result = [];

            const curr = new Date(first);
            while (curr <= last) {
                const yyyy = curr.getFullYear();
                const mm = String(curr.getMonth() + 1).padStart(2, '0');
                const dd = String(curr.getDate()).padStart(2, '0');
                const key = `${yyyy}-${mm}-${dd}`;

                if (map.has(key)) {
                    result.push(map.get(key));
                } else {
                    result.push({
                        time_key: key,
                        label: `${dd}/${mm}/${yyyy}`,
                        short_label: `${dd}/${mm}`,
                        orders_count: 0,
                        revenue: 0
                    });
                }
                curr.setDate(curr.getDate() + 1);
            }
            return result;
        } else if (period === 'month') {
            const sortedKeys = timelineRaw.map(t => t.time_key).sort();
            const [firstY, firstM] = sortedKeys[0].split('-').map(Number);
            const [lastY, lastM] = sortedKeys[sortedKeys.length - 1].split('-').map(Number);
            const result = [];

            let y = firstY;
            let m = firstM;
            while (y < lastY || (y === lastY && m <= lastM)) {
                const mm = String(m).padStart(2, '0');
                const key = `${y}-${mm}`;

                if (map.has(key)) {
                    result.push(map.get(key));
                } else {
                    result.push({
                        time_key: key,
                        label: `${mm}/${y}`,
                        short_label: `${mm}/${y}`,
                        orders_count: 0,
                        revenue: 0
                    });
                }

                m++;
                if (m > 12) {
                    m = 1;
                    y++;
                }
            }
            return result;
        } else if (period === 'week') {
            const sortedKeys = timelineRaw.map(t => t.time_key).sort();
            const firstKey = sortedKeys[0];
            const lastKey = sortedKeys[sortedKeys.length - 1];
            const [firstY, firstW] = firstKey.split('-W').map(Number);
            const [lastY, lastW] = lastKey.split('-W').map(Number);
            const result = [];

            let y = firstY;
            let w = firstW;
            while (y < lastY || (y === lastY && w <= lastW)) {
                const ww = String(w).padStart(2, '0');
                const key = `${y}-W${ww}`;

                if (map.has(key)) {
                    result.push(map.get(key));
                } else {
                    result.push({
                        time_key: key,
                        label: `Sett. ${ww} (${y})`,
                        short_label: `Sett. ${ww}`,
                        orders_count: 0,
                        revenue: 0
                    });
                }

                w++;
                if (w > 52) {
                    w = 0;
                    y++;
                }
            }
            return result;
        }

        return timelineRaw;
    }

    /**
     * Generate a monotone cubic spline SVG path that never undershoots or overshoots.
     * Prevents negative dips below the baseline when transitioning from 0 to positive sales.
     */
    function buildMonotoneSplinePath(points, baselineY) {
        const n = points.length;
        if (n === 0) return '';
        if (n === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${(points[0].x + 1).toFixed(1)} ${points[0].y.toFixed(1)}`;

        // 1. Calculate secants (slopes between consecutive points)
        const dxs = [];
        const dys = [];
        const slopes = [];
        for (let i = 0; i < n - 1; i++) {
            const dx = points[i + 1].x - points[i].x;
            const dy = points[i + 1].y - points[i].y;
            dxs.push(dx);
            dys.push(dy);
            slopes.push(dx !== 0 ? dy / dx : 0);
        }

        // 2. Calculate initial tangents
        const tangents = [slopes[0]];
        for (let i = 1; i < n - 1; i++) {
            if (slopes[i - 1] * slopes[i] <= 0) {
                // If slope changes sign or either is flat, clamp tangent to 0 (flat horizontal)
                tangents.push(0);
            } else {
                tangents.push((slopes[i - 1] + slopes[i]) / 2);
            }
        }
        tangents.push(slopes[n - 2]);

        // 3. Fritsch-Carlson monotonicity condition
        for (let i = 0; i < n - 1; i++) {
            if (dys[i] === 0) {
                tangents[i] = 0;
                tangents[i + 1] = 0;
            } else {
                const alpha = tangents[i] / slopes[i];
                const beta = tangents[i + 1] / slopes[i];
                const dist = alpha * alpha + beta * beta;
                if (dist > 9) {
                    const tau = 3 / Math.sqrt(dist);
                    tangents[i] = tau * alpha * slopes[i];
                    tangents[i + 1] = tau * beta * slopes[i];
                }
            }
        }

        // 4. Build cubic Bezier curve segments
        let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 0; i < n - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const dx = dxs[i];

            const cp1x = p1.x + dx / 3;
            let cp1y = p1.y + (tangents[i] * dx) / 3;
            const cp2x = p2.x - dx / 3;
            let cp2y = p2.y - (tangents[i + 1] * dx) / 3;

            // Strict clamp: never dip below baseline (revenue >= 0)
            if (baselineY !== undefined) {
                cp1y = Math.min(cp1y, baselineY);
                cp2y = Math.min(cp2y, baselineY);
            }

            path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }

        return path;
    }

    /**
     * Render the Sales Wave Spline Area Chart.
     */
    function renderSalesWaveChart(timelineObj, period) {
        const container = document.getElementById('reports-sales-chart-container');
        if (!container) return;

        hideReportsChartTooltip();

        const rawTimeline = (timelineObj && timelineObj[period]) ? timelineObj[period] : [];
        const timeline = fillContinuousTimeline(rawTimeline, period);

        if (!timeline || timeline.length === 0) {
            container.innerHTML = '<div class="reports-empty-state">Nessuna vendita registrata nel periodo selezionato.</div>';
            return;
        }

        let maxRevenue = 0;
        let peakKey = '';
        timeline.forEach(slot => {
            const rev = Number(slot.revenue) || 0;
            if (rev > maxRevenue) {
                maxRevenue = rev;
                peakKey = slot.time_key;
            }
        });

        const svgWidth = 900;
        const svgHeight = 160;
        const paddingX = 45;
        const paddingTop = 25;
        const paddingBottom = 30;

        const count = timeline.length;
        const usableWidth = svgWidth - (paddingX * 2);
        const usableHeight = svgHeight - paddingTop - paddingBottom;

        const baselineY = svgHeight - paddingBottom;

        // Compute (x, y) coordinates
        const points = timeline.map((slot, i) => {
            const x = count === 1 ? svgWidth / 2 : paddingX + (i * (usableWidth / (count - 1)));
            const rev = Number(slot.revenue) || 0;
            const ratio = maxRevenue > 0 ? (rev / maxRevenue) : 0;
            const y = baselineY - (ratio * usableHeight);
            return { x, y, slot };
        });

        // Build monotone cubic spline path (no negative dips below baseline)
        const linePath = buildMonotoneSplinePath(points, baselineY);

        const firstX = points[0].x;
        const lastX = points[points.length - 1].x;
        const bottomY = baselineY + 8;
        const areaPath = `${linePath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;

        const dotsHtml = points.map(pt => {
            const rev = Number(pt.slot.revenue) || 0;
            if (rev <= 0) return ''; // Do not render dots on zero-sales days

            const isPeak = (pt.slot.time_key === peakKey && maxRevenue > 0);
            const revenueText = formatCurrency(rev);
            const orderText = pt.slot.orders_count === 1 ? '1 scontrino' : `${pt.slot.orders_count} scontrini`;
            const titleLabel = pt.slot.label || pt.slot.time_key;

            return `
                <circle class="reports-wave-dot ${isPeak ? 'peak-dot' : ''}" 
                        cx="${pt.x.toFixed(1)}" 
                        cy="${pt.y.toFixed(1)}"
                        onmouseenter="showReportsChartTooltip(event, '${escapeHtml(titleLabel)}', '${revenueText}', '${orderText}')"
                        onmouseleave="hideReportsChartTooltip()">
                </circle>
            `;
        }).join('');

        // Step intervals for x-axis labels
        const maxLabels = 10;
        const step = Math.ceil(points.length / maxLabels);

        const labelsHtml = points.map((pt, idx) => {
            if (idx % step !== 0 && idx !== points.length - 1) return '';
            return `
                <span class="reports-wave-label" style="position: absolute; left: ${(pt.x / svgWidth * 100).toFixed(2)}%; transform: translateX(-50%);">
                    ${escapeHtml(pt.slot.short_label || pt.slot.time_key)}
                </span>
            `;
        }).join('');

        container.innerHTML = `
            <svg class="reports-wave-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="reportsWaveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#2563eb" stop-opacity="0.25" />
                        <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0" />
                    </linearGradient>
                </defs>
                <path class="reports-wave-area-path" d="${areaPath}" />
                <path class="reports-wave-line-path" d="${linePath}" />
                ${dotsHtml}
            </svg>
            <div class="reports-wave-labels-wrap">
                ${labelsHtml}
            </div>
        `;
    }

    /**
     * Render the Overview section: KPIs, charts, and breakdowns.
     */
    function renderOverviewSection(data) {
        const totals = data.totals || {};
        const sagras = data.sagras || [];
        const categoryBreakdown = data.categoryBreakdown || [];
        const timeline = data.timeline || {};

        // 1. KPI Cards
        const totalRevenueEl = document.getElementById('rep-kpi-total-revenue');
        if (totalRevenueEl) totalRevenueEl.innerText = formatCurrency(totals.totalRevenue);

        const totalOrdersEl = document.getElementById('rep-kpi-total-orders');
        if (totalOrdersEl) totalOrdersEl.innerText = (totals.totalOrders || 0).toLocaleString('it-IT');

        const avgOrderEl = document.getElementById('rep-kpi-avg-order');
        if (avgOrderEl) avgOrderEl.innerText = formatCurrency(totals.averageOrderValue);

        const totalSagrasEl = document.getElementById('rep-kpi-total-sagras');
        if (totalSagrasEl) totalSagrasEl.innerText = (totals.totalSagras || 0).toLocaleString('it-IT');

        const bestSellerNameEl = document.getElementById('rep-kpi-bestseller-name');
        const bestSellerQtyEl = document.getElementById('rep-kpi-bestseller-qty');
        if (totals.bestSeller) {
            if (bestSellerNameEl) bestSellerNameEl.innerText = totals.bestSeller.product_name;
            if (bestSellerQtyEl) bestSellerQtyEl.innerText = `${totals.bestSeller.total_qty} venduti (${formatCurrency(totals.bestSeller.total_revenue)})`;
        } else {
            if (bestSellerNameEl) bestSellerNameEl.innerText = 'Nessun piatto';
            if (bestSellerQtyEl) bestSellerQtyEl.innerText = '0 venduti';
        }

        // 2. Sales Timeline Wave Chart
        renderSalesWaveChart(timeline, reportsState.timelinePeriod);

        // 3. Sagras and Categories Comparisons
        renderSagrasRevenueChart(sagras, totals.totalRevenue);
        renderCategoryBreakdown(categoryBreakdown, totals.totalRevenue);

        // 4. Events Tab Section Table & Comparison
        renderEventsTabSection(sagras);
    }

    /**
     * Render Sagra revenue bar comparison.
     */
    function renderSagrasRevenueChart(sagras, totalRevenue) {
        const container = document.getElementById('rep-chart-sagras-bars');
        if (!container) return;

        if (!sagras || sagras.length === 0) {
            container.innerHTML = '<div class="reports-empty-state">Nessun evento registrato nel periodo</div>';
            return;
        }

        // 1. Sort all sagras descending by revenue
        const sorted = [...sagras].sort((a, b) => (Number(b.revenue) || 0) - (Number(a.revenue) || 0));

        // 2. Limit to top 5 and group the rest in a 6th "Altri" entry
        let displayList = sorted;
        if (sorted.length > 5) {
            const top5 = sorted.slice(0, 5);
            const remaining = sorted.slice(5);
            const othersRevenue = remaining.reduce((sum, s) => sum + (Number(s.revenue) || 0), 0);
            const othersOrders = remaining.reduce((sum, s) => sum + (Number(s.orders_count) || 0), 0);

            displayList = [
                ...top5,
                {
                    name: `Altri (${remaining.length} eventi)`,
                    revenue: othersRevenue,
                    orders_count: othersOrders,
                    isOther: true
                }
            ];
        }

        const barsHtml = displayList.map(s => {
            const rev = Number(s.revenue) || 0;
            const globalShare = totalRevenue > 0 ? ((rev / totalRevenue) * 100).toFixed(1) : '0.0';
            const percentage = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0;

            return `
                <div class="reports-progress-item">
                    <div class="reports-progress-header">
                        <span class="reports-progress-title" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
                        <div class="reports-progress-values">
                            <span class="reports-progress-amount">${formatCurrency(rev)}</span>
                            <span class="reports-progress-sub">(${s.orders_count} ordini • ${globalShare}%)</span>
                        </div>
                    </div>
                    <div class="reports-progress-track">
                        <div class="reports-progress-fill" style="width: ${Math.max(percentage, rev > 0 ? 1 : 0)}%;"></div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = barsHtml;
    }

    /**
     * Render Category Breakdown progress items.
     */
    function renderCategoryBreakdown(categories, totalRevenue) {
        const container = document.getElementById('rep-chart-categories-list');
        if (!container) return;

        if (!categories || categories.length === 0) {
            container.innerHTML = '<div class="reports-empty-state">Nessun dato per categorie nel periodo</div>';
            return;
        }

        // Sort categories descending by revenue
        const sortedCategories = [...categories].sort((a, b) => (Number(b.total_revenue) || 0) - (Number(a.total_revenue) || 0));

        const html = sortedCategories.map(cat => {
            const rev = Number(cat.total_revenue) || 0;
            const share = totalRevenue > 0 ? ((rev / totalRevenue) * 100).toFixed(1) : '0.0';
            const percentage = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0;

            return `
                <div class="reports-progress-item">
                    <div class="reports-progress-header">
                        <span class="reports-progress-title" title="${escapeHtml(cat.category_name)}">${escapeHtml(cat.category_name)}</span>
                        <div class="reports-progress-values">
                            <span class="reports-progress-amount">${formatCurrency(rev)}</span>
                            <span class="reports-progress-sub">(${cat.total_qty.toLocaleString('it-IT')} pezzi • ${share}%)</span>
                        </div>
                    </div>
                    <div class="reports-progress-track">
                        <div class="reports-progress-fill" style="width: ${Math.max(percentage, rev > 0 ? 1 : 0)}%;"></div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Helper to sort list of events based on column and direction.
     */
    function sortEventsList(list, key, direction) {
        return [...list].sort((a, b) => {
            let valA, valB;
            if (key === 'name') {
                valA = (a.name || '').toLowerCase();
                valB = (b.name || '').toLowerCase();
                return direction === 'asc' ? valA.localeCompare(valB, 'it') : valB.localeCompare(valA, 'it');
            } else if (key === 'date') {
                valA = a.created_at ? new Date(a.created_at).getTime() : 0;
                valB = b.created_at ? new Date(b.created_at).getTime() : 0;
                if (valA === valB) {
                    valA = Number(a.id) || 0;
                    valB = Number(b.id) || 0;
                }
            } else if (key === 'orders') {
                valA = Number(a.orders_count) || 0;
                valB = Number(b.orders_count) || 0;
            } else if (key === 'revenue') {
                valA = Number(a.revenue) || 0;
                valB = Number(b.revenue) || 0;
            } else if (key === 'avg') {
                const ordersA = Number(a.orders_count) || 0;
                const ordersB = Number(b.orders_count) || 0;
                valA = ordersA > 0 ? (Number(a.revenue) || 0) / ordersA : 0;
                valB = ordersB > 0 ? (Number(b.revenue) || 0) / ordersB : 0;
            }
            return direction === 'asc' ? valA - valB : valB - valA;
        });
    }

    /**
     * Update sort arrow icons in table header.
     */
    function updateSortHeaderIcons() {
        const icons = document.querySelectorAll('.reports-sort-icon');
        icons.forEach(icon => {
            const key = icon.getAttribute('data-sort-icon');
            if (key === eventsTableState.sortKey) {
                icon.innerText = eventsTableState.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
                icon.classList.add('active');
            } else {
                icon.innerText = '';
                icon.classList.remove('active');
            }
        });
    }

    /**
     * Sort events table by a given column key.
     */
    function sortReportsEventsBy(key) {
        if (eventsTableState.sortKey === key) {
            eventsTableState.sortDirection = eventsTableState.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            eventsTableState.sortKey = key;
            eventsTableState.sortDirection = (key === 'name' ? 'asc' : 'desc');
        }

        updateSortHeaderIcons();

        eventsTableState.filteredList = sortEventsList(eventsTableState.filteredList, eventsTableState.sortKey, eventsTableState.sortDirection);
        renderNextEventsChunk(true);

        const wrapper = document.getElementById('rep-events-table-wrapper');
        if (wrapper) wrapper.scrollTop = 0;
    }

    /**
     * Render the Dettaglio Eventi list section.
     */
    function renderEventsTabSection(sagras) {
        const list = sagras || [];
        eventsTableState.rawList = list;

        const searchInput = document.getElementById('rep-events-search-input');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        let filtered = list;
        if (query) {
            filtered = list.filter(s => (s.name && s.name.toLowerCase().includes(query)));
        }

        eventsTableState.filteredList = sortEventsList(filtered, eventsTableState.sortKey, eventsTableState.sortDirection);

        const countBadge = document.getElementById('rep-events-count-badge');
        if (countBadge) {
            countBadge.innerText = `${eventsTableState.filteredList.length} ${eventsTableState.filteredList.length === 1 ? 'evento' : 'eventi'}`;
        }

        updateSortHeaderIcons();
        renderNextEventsChunk(true);

        // Populate custom comparison dropdowns
        populateCompareEventSelectors(list);
    }

    /**
     * Render a chunk of 10 events (or next 10 upon scrolling).
     */
    function renderNextEventsChunk(reset = false) {
        const tbody = document.getElementById('rep-events-tbody');
        if (!tbody) return;

        if (reset) {
            tbody.innerHTML = '';
            eventsTableState.renderedCount = 0;
        }

        const totalItems = eventsTableState.filteredList.length;
        if (totalItems === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="reports-table-empty">Nessun evento registrato nel periodo selezionato.</td></tr>`;
            eventsTableState.renderedCount = 0;
            return;
        }

        if (eventsTableState.renderedCount >= totalItems) return;

        const nextChunk = eventsTableState.filteredList.slice(
            eventsTableState.renderedCount,
            eventsTableState.renderedCount + eventsTableState.pageSize
        );

        const rowsHtml = nextChunk.map((s, i) => {
            const globalIndex = eventsTableState.renderedCount + i + 1;
            const rev = Number(s.revenue) || 0;
            const orders = Number(s.orders_count) || 0;
            const avg = orders > 0 ? (rev / orders) : 0;
            const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

            return `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: var(--text-light);">${globalIndex}</td>
                    <td>
                        <button type="button" class="reports-event-link-btn" onclick="openEventStatsModal(${s.id})" title="Apri statistiche evento">
                            <span class="material-symbols-rounded" style="font-size: 18px; color: var(--primary);">festival</span>
                            <span class="reports-event-name-text">${escapeHtml(s.name)}</span>
                        </button>
                    </td>
                    <td style="color: var(--text-light);">${dateStr}</td>
                    <td style="text-align: right; font-weight: 600;">${orders.toLocaleString('it-IT')}</td>
                    <td style="text-align: right; font-weight: 700; color: var(--primary);">${formatCurrency(rev)}</td>
                    <td style="text-align: right; color: var(--text-light);">${formatCurrency(avg)}</td>
                    <td style="text-align: center;">
                        <button type="button" class="reports-table-action-btn" onclick="openEventStatsModal(${s.id})" title="Visualizza statistiche complete">
                            <span class="material-symbols-rounded">bar_chart</span>
                            <span>Statistiche</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (reset) {
            tbody.innerHTML = rowsHtml;
        } else {
            tbody.insertAdjacentHTML('beforeend', rowsHtml);
        }

        eventsTableState.renderedCount += nextChunk.length;
    }

    /**
     * Infinite scroll event handler for the table wrapper.
     */
    function handleEventsTableScroll(container) {
        if (!container) return;
        if (eventsTableState.renderedCount >= eventsTableState.filteredList.length) return;
        if (eventsTableState.isLoadingMore) return;

        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 30) {
            eventsTableState.isLoadingMore = true;
            renderNextEventsChunk(false);
            eventsTableState.isLoadingMore = false;
        }
    }

    /**
     * Filter events list by search query.
     */
    function filterReportsEventsList() {
        const searchInput = document.getElementById('rep-events-search-input');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const list = eventsTableState.rawList || [];

        let filtered = list;
        if (query) {
            filtered = list.filter(s => (s.name && s.name.toLowerCase().includes(query)));
        }

        eventsTableState.filteredList = sortEventsList(filtered, eventsTableState.sortKey, eventsTableState.sortDirection);

        const countBadge = document.getElementById('rep-events-count-badge');
        if (countBadge) {
            countBadge.innerText = `${eventsTableState.filteredList.length} ${eventsTableState.filteredList.length === 1 ? 'evento' : 'eventi'}`;
        }

        renderNextEventsChunk(true);

        const wrapper = document.getElementById('rep-events-table-wrapper');
        if (wrapper) wrapper.scrollTop = 0;
    }

    /**
     * Populate Custom Dropdown Selectors for Event 1 and Event 2.
     */
    function populateCompareEventSelectors(sagras) {
        const list = sagras || [];

        if (list.length === 0) {
            const text1 = document.getElementById('rep-custom-select-text-1');
            const text2 = document.getElementById('rep-custom-select-text-2');
            if (text1) text1.innerText = 'Nessun evento';
            if (text2) text2.innerText = 'Nessun confronto';
            compareState.event1Id = null;
            compareState.event2Id = 'none';
            renderCompareEmptyState("Nessun evento disponibile nel periodo selezionato.");
            return;
        }

        // Validate or set default Event 1
        if (!compareState.event1Id || !list.some(s => String(s.id) === String(compareState.event1Id))) {
            compareState.event1Id = list[0].id;
        }

        // Validate Event 2
        if (compareState.event2Id !== 'none' && !list.some(s => String(s.id) === String(compareState.event2Id))) {
            compareState.event2Id = 'none';
        }

        renderCompareDropdownOptions(1, list, '');
        renderCompareDropdownOptions(2, list, '');
        updateCompareButtonLabels();
        loadAndRenderEventComparison();
    }

    /**
     * Render the items inside a custom comparison dropdown list.
     */
    function renderCompareDropdownOptions(index, list, query) {
        const container = document.getElementById(`rep-dropdown-options-${index}`);
        if (!container) return;

        const cleanQuery = (query || '').trim().toLowerCase();
        let filtered = list;
        if (cleanQuery) {
            filtered = list.filter(s => (s.name && s.name.toLowerCase().includes(cleanQuery)));
        }

        let html = '';

        // For Event 2, include "Nessun confronto" option
        if (index === 2) {
            const isNoneActive = compareState.event2Id === 'none';
            if (!cleanQuery || 'nessun confronto'.includes(cleanQuery)) {
                html += `
                    <button type="button" class="reports-dropdown-option ${isNoneActive ? 'active' : ''}" onclick="selectCompareDropdownOption(2, 'none')">
                        <div class="reports-dropdown-option-left">
                            <span class="material-symbols-rounded" style="font-size:18px; color:var(--text-light);">block</span>
                            <span class="option-name">Nessun confronto</span>
                        </div>
                    </button>
                `;
            }
        }

        if (filtered.length === 0 && (!html || index === 1)) {
            container.innerHTML = '<div class="reports-dropdown-empty">Nessun evento trovato</div>';
            return;
        }

        const selectedId = index === 1 ? compareState.event1Id : compareState.event2Id;

        html += filtered.map(s => {
            const isActive = String(s.id) === String(selectedId);
            const rev = Number(s.revenue) || 0;
            return `
                <button type="button" class="reports-dropdown-option ${isActive ? 'active' : ''}" onclick="selectCompareDropdownOption(${index}, ${s.id})">
                    <div class="reports-dropdown-option-left">
                        <span class="material-symbols-rounded" style="font-size:18px; color:${index === 1 ? '#2563eb' : '#8b5cf6'};">festival</span>
                        <span class="option-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
                    </div>
                    <span class="reports-dropdown-option-right">${formatCurrency(rev)}</span>
                </button>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Update trigger button labels based on compareState.
     */
    function updateCompareButtonLabels() {
        const text1 = document.getElementById('rep-custom-select-text-1');
        const text2 = document.getElementById('rep-custom-select-text-2');
        const list = eventsTableState.rawList || [];

        if (text1) {
            const s1 = list.find(s => String(s.id) === String(compareState.event1Id));
            text1.innerText = s1 ? s1.name : 'Seleziona evento...';
        }

        if (text2) {
            if (compareState.event2Id === 'none') {
                text2.innerText = 'Nessun confronto';
            } else {
                const s2 = list.find(s => String(s.id) === String(compareState.event2Id));
                text2.innerText = s2 ? s2.name : 'Nessun confronto';
            }
        }
    }

    /**
     * Toggle custom dropdown open/close state.
     */
    function toggleCompareDropdown(index, e) {
        if (e) e.stopPropagation();

        const panel = document.getElementById(`rep-custom-dropdown-${index}`);
        const btn = document.getElementById(`rep-custom-select-btn-${index}`);
        const otherIndex = index === 1 ? 2 : 1;
        const otherPanel = document.getElementById(`rep-custom-dropdown-${otherIndex}`);
        const otherBtn = document.getElementById(`rep-custom-select-btn-${otherIndex}`);

        if (otherPanel) otherPanel.style.display = 'none';
        if (otherBtn) otherBtn.classList.remove('open');

        if (!panel || !btn) return;

        const isOpen = panel.style.display === 'flex';
        if (isOpen) {
            panel.style.display = 'none';
            btn.classList.remove('open');
        } else {
            panel.style.display = 'flex';
            btn.classList.add('open');

            // Reset search input and re-render full list
            const searchInput = document.getElementById(`rep-dropdown-search-${index}`);
            if (searchInput) {
                searchInput.value = '';
                setTimeout(() => searchInput.focus(), 50);
            }
            renderCompareDropdownOptions(index, eventsTableState.rawList || [], '');
        }
    }

    /**
     * Close all custom comparison dropdowns.
     */
    function closeAllCompareDropdowns() {
        [1, 2].forEach(idx => {
            const panel = document.getElementById(`rep-custom-dropdown-${idx}`);
            const btn = document.getElementById(`rep-custom-select-btn-${idx}`);
            if (panel) panel.style.display = 'none';
            if (btn) btn.classList.remove('open');
        });
    }

    // Close custom dropdowns on clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.reports-custom-select-box')) {
            closeAllCompareDropdowns();
        }
    });

    /**
     * Filter items inside a custom dropdown by search query.
     */
    function filterCompareDropdownItems(index, query) {
        renderCompareDropdownOptions(index, eventsTableState.rawList || [], query);
    }

    /**
     * Select an option in a custom comparison dropdown.
     */
    function selectCompareDropdownOption(index, id) {
        if (index === 1) {
            compareState.event1Id = id;
        } else {
            compareState.event2Id = id;
        }

        closeAllCompareDropdowns();
        updateCompareButtonLabels();
        loadAndRenderEventComparison();
    }

    /**
     * Load stats for selected events and render dual wave chart.
     */
    async function loadAndRenderEventComparison() {
        const container = document.getElementById('reports-compare-chart-container');
        const summaryBar = document.getElementById('reports-compare-summary-bar');
        if (!container) return;

        const id1 = compareState.event1Id;
        const id2 = compareState.event2Id;

        if (!id1) {
            renderCompareEmptyState("Seleziona almeno un evento per visualizzare il grafico.");
            return;
        }

        compareState.isLoading = true;
        container.innerHTML = '<div class="reports-loading-spinner" style="margin: 40px auto;"></div>';

        try {
            const dateParams = new URLSearchParams();
            if (reportsState.dateFilter.startDate) dateParams.append('start_date', reportsState.dateFilter.startDate);
            if (reportsState.dateFilter.endDate) dateParams.append('end_date', reportsState.dateFilter.endDate);
            const dateQuery = dateParams.toString() ? `&${dateParams.toString()}` : '';

            // Fetch Event 1 stats
            const res1 = await fetch(`/api/stats?sagraId=${id1}${dateQuery}`);
            const data1 = await res1.json();

            let data2 = null;
            if (id2 && id2 !== 'none' && String(id2) !== String(id1)) {
                const res2 = await fetch(`/api/stats?sagraId=${id2}${dateQuery}`);
                data2 = await res2.json();
            }

            const sagra1 = (eventsTableState.rawList || []).find(s => String(s.id) === String(id1)) || { name: `Evento #${id1}` };
            const sagra2 = data2 ? ((eventsTableState.rawList || []).find(s => String(s.id) === String(id2)) || { name: `Evento #${id2}` }) : null;

            // Render summary badges bar
            if (summaryBar) {
                let summaryHtml = `
                    <div class="reports-compare-pill pill-event-1">
                        <span class="pill-dot" style="background:#2563eb;"></span>
                        <span>${escapeHtml(sagra1.name)}:</span>
                        <span class="pill-stat">${formatCurrency(data1.totalRevenue || 0)}</span>
                        <span style="opacity:0.8;font-size:0.75rem;">(${data1.ordersCount || 0} ordini)</span>
                    </div>
                `;
                if (sagra2 && data2) {
                    summaryHtml += `
                        <div class="reports-compare-pill pill-event-2">
                            <span class="pill-dot" style="background:#8b5cf6;"></span>
                            <span>${escapeHtml(sagra2.name)}:</span>
                            <span class="pill-stat">${formatCurrency(data2.totalRevenue || 0)}</span>
                            <span style="opacity:0.8;font-size:0.75rem;">(${data2.ordersCount || 0} ordini)</span>
                        </div>
                    `;
                }
                summaryBar.innerHTML = summaryHtml;
            }

            renderCompareDualWaveChart(data1, sagra1.name, data2, sagra2 ? sagra2.name : null);
        } catch (err) {
            console.error("Comparison chart load error:", err);
            renderCompareEmptyState("Errore nel caricamento del confronto.");
        } finally {
            compareState.isLoading = false;
        }
    }

    /**
     * Render empty state for compare container.
     */
    function renderCompareEmptyState(message) {
        const container = document.getElementById('reports-compare-chart-container');
        const summaryBar = document.getElementById('reports-compare-summary-bar');
        if (summaryBar) summaryBar.innerHTML = '';
        if (container) {
            container.innerHTML = `<div class="reports-empty-state">${escapeHtml(message)}</div>`;
        }
    }

    /**
     * Show custom tooltip for comparison chart.
     */
    function showCompareChartTooltip(e, hourLabel, name1, rev1, name2, rev2) {
        const tooltip = document.getElementById('reports-compare-tooltip');
        if (!tooltip) return;

        let contentHtml = `<div class="reports-tooltip-time">Ore ${escapeHtml(hourLabel)}</div>`;
        contentHtml += `
            <div class="reports-tooltip-val" style="color:#2563eb; font-size: 0.86rem; margin-bottom: 2px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2563eb;margin-right:6px;"></span>
                <span>${escapeHtml(name1)}: ${formatCurrency(rev1)}</span>
            </div>
        `;
        if (name2) {
            contentHtml += `
                <div class="reports-tooltip-val" style="color:#8b5cf6; font-size: 0.86rem;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8b5cf6;margin-right:6px;"></span>
                    <span>${escapeHtml(name2)}: ${formatCurrency(rev2)}</span>
                </div>
            `;
        }

        tooltip.innerHTML = contentHtml;

        const dot = e.target;
        const parent = tooltip.offsetParent || tooltip.parentElement;
        if (dot && parent) {
            const dotRect = dot.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();

            const left = dotRect.left - parentRect.left + (dotRect.width / 2);
            const top = dotRect.top - parentRect.top - 8;

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        }

        tooltip.classList.add('visible');
    }

    /**
     * Hide custom tooltip for comparison chart.
     */
    function hideCompareChartTooltip() {
        const tooltip = document.getElementById('reports-compare-tooltip');
        if (tooltip) tooltip.classList.remove('visible');
    }

    /**
     * Render the Dual Wave Chart for hourly comparison.
     */
    function renderCompareDualWaveChart(data1, name1, data2, name2) {
        const container = document.getElementById('reports-compare-chart-container');
        if (!container) return;

        hideCompareChartTooltip();

        const hourly1 = (data1 && data1.hourlySales) ? data1.hourlySales : [];
        const hourly2 = (data2 && data2.hourlySales) ? data2.hourlySales : [];

        // Build hour map from 00 to 23
        const map1 = new Map();
        hourly1.forEach(h => {
            const slotHour = parseInt(h.hour_slot.split(':')[0], 10);
            map1.set(slotHour, (map1.get(slotHour) || 0) + (Number(h.revenue) || 0));
        });

        const map2 = new Map();
        hourly2.forEach(h => {
            const slotHour = parseInt(h.hour_slot.split(':')[0], 10);
            map2.set(slotHour, (map2.get(slotHour) || 0) + (Number(h.revenue) || 0));
        });

        // Determine active range of hours (e.g. from 09:00 to 23:00 or active min to max)
        const activeHours = [];
        for (let h = 0; h <= 23; h++) {
            if ((map1.get(h) || 0) > 0 || (map2.get(h) || 0) > 0) {
                activeHours.push(h);
            }
        }

        let startHour = 9;
        let endHour = 23;
        if (activeHours.length > 0) {
            startHour = Math.max(0, Math.min(...activeHours) - 1);
            endHour = Math.min(23, Math.max(...activeHours) + 1);
            if (endHour - startHour < 8) {
                endHour = Math.min(23, startHour + 8);
                if (endHour === 23) startHour = Math.max(0, endHour - 8);
            }
        }

        // Build continuous hourly slots
        const slots = [];
        let maxRevenue = 0;

        for (let h = startHour; h <= endHour; h++) {
            const hourLabel = `${String(h).padStart(2, '0')}:00`;
            const rev1 = map1.get(h) || 0;
            const rev2 = map2.get(h) || 0;
            if (rev1 > maxRevenue) maxRevenue = rev1;
            if (rev2 > maxRevenue) maxRevenue = rev2;
            slots.push({ hour: h, label: hourLabel, rev1, rev2 });
        }

        if (slots.length === 0) {
            container.innerHTML = '<div class="reports-empty-state">Nessuna fascia oraria disponibile.</div>';
            return;
        }

        const svgWidth = 900;
        const svgHeight = 170;
        const paddingX = 45;
        const paddingTop = 25;
        const paddingBottom = 30;

        const count = slots.length;
        const usableWidth = svgWidth - (paddingX * 2);
        const usableHeight = svgHeight - paddingTop - paddingBottom;
        const baselineY = svgHeight - paddingBottom;

        // Points for Wave 1
        const points1 = slots.map((slot, i) => {
            const x = count === 1 ? svgWidth / 2 : paddingX + (i * (usableWidth / (count - 1)));
            const ratio = maxRevenue > 0 ? (slot.rev1 / maxRevenue) : 0;
            const y = baselineY - (ratio * usableHeight);
            return { x, y, slot };
        });

        // Points for Wave 2
        const points2 = slots.map((slot, i) => {
            const x = count === 1 ? svgWidth / 2 : paddingX + (i * (usableWidth / (count - 1)));
            const ratio = maxRevenue > 0 ? (slot.rev2 / maxRevenue) : 0;
            const y = baselineY - (ratio * usableHeight);
            return { x, y, slot };
        });

        // Spline paths
        const linePath1 = buildMonotoneSplinePath(points1, baselineY);
        const firstX = points1[0].x;
        const lastX = points1[points1.length - 1].x;
        const bottomY = baselineY + 8;
        const areaPath1 = `${linePath1} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;

        let wave2Markup = '';
        if (data2 && name2) {
            const linePath2 = buildMonotoneSplinePath(points2, baselineY);
            const areaPath2 = `${linePath2} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;

            const dots2 = points2.map(pt => {
                if (pt.slot.rev2 <= 0) return '';
                return `
                    <circle class="reports-wave-dot compare-dot-2" 
                            cx="${pt.x.toFixed(1)}" 
                            cy="${pt.y.toFixed(1)}"
                            style="fill:#8b5cf6; stroke:#ffffff; stroke-width:2;"
                            onmouseenter="showCompareChartTooltip(event, '${escapeHtml(pt.slot.label)}', '${escapeHtml(name1)}', ${pt.slot.rev1}, '${escapeHtml(name2)}', ${pt.slot.rev2})"
                            onmouseleave="hideCompareChartTooltip()">
                    </circle>
                `;
            }).join('');

            wave2Markup = `
                <path class="reports-wave-area-path" d="${areaPath2}" style="fill:url(#compareGradient2);" />
                <path class="reports-wave-line-path" d="${linePath2}" style="stroke:#8b5cf6;" />
                ${dots2}
            `;
        }

        const dots1 = points1.map((pt, i) => {
            if (pt.slot.rev1 <= 0 && (!data2 || points2[i].slot.rev2 <= 0)) return '';
            return `
                <circle class="reports-wave-dot compare-dot-1" 
                        cx="${pt.x.toFixed(1)}" 
                        cy="${pt.y.toFixed(1)}"
                        style="fill:#2563eb; stroke:#ffffff; stroke-width:2;"
                        onmouseenter="showCompareChartTooltip(event, '${escapeHtml(pt.slot.label)}', '${escapeHtml(name1)}', ${pt.slot.rev1}, ${name2 ? `'${escapeHtml(name2)}'` : 'null'}, ${points2[i].slot.rev2})"
                        onmouseleave="hideCompareChartTooltip()">
                </circle>
            `;
        }).join('');

        const labelsHtml = slots.map((slot, idx) => {
            const x = count === 1 ? svgWidth / 2 : paddingX + (idx * (usableWidth / (count - 1)));
            return `
                <span class="reports-wave-label" style="position: absolute; left: ${(x / svgWidth * 100).toFixed(2)}%; transform: translateX(-50%);">
                    ${escapeHtml(slot.label)}
                </span>
            `;
        }).join('');

        container.innerHTML = `
            <svg class="reports-wave-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="compareGradient1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#2563eb" stop-opacity="0.28" />
                        <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0" />
                    </linearGradient>
                    <linearGradient id="compareGradient2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.25" />
                        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.0" />
                    </linearGradient>
                </defs>
                ${wave2Markup}
                <path class="reports-wave-area-path" d="${areaPath1}" style="fill:url(#compareGradient1);" />
                <path class="reports-wave-line-path" d="${linePath1}" style="stroke:#2563eb;" />
                ${dots1}
            </svg>
            <div class="reports-wave-labels-wrap">
                ${labelsHtml}
            </div>
        `;
    }

    /**
     * Open the existing POS statistics modal for the selected event.
     */
    function openEventStatsModal(sagraId) {
        if (typeof window.showStats === 'function') {
            window.showStats(sagraId, reportsState.dateFilter);
        } else {
            console.warn("window.showStats is not available");
        }
    }

    /**
     * Render error view.
     */
    function renderOverviewError(message) {
        const container = document.getElementById('rep-chart-sagras-bars');
        if (container) {
            container.innerHTML = `<div class="reports-empty-state" style="color:var(--danger, #ef4444);">Errore caricamento: ${escapeHtml(message)}</div>`;
        }
    }

    // Expose global functions to window
    window.openReportsView = openReportsView;
    window.closeReportsView = closeReportsView;
    window.switchReportsTab = switchReportsTab;
    window.changeReportsTimelinePeriod = changeReportsTimelinePeriod;
    window.showReportsChartTooltip = showReportsChartTooltip;
    window.hideReportsChartTooltip = hideReportsChartTooltip;
    window.showCompareChartTooltip = showCompareChartTooltip;
    window.hideCompareChartTooltip = hideCompareChartTooltip;
    window.openReportsDateRangeModal = openReportsDateRangeModal;
    window.closeReportsDateRangeModal = closeReportsDateRangeModal;
    window.selectReportsPreset = selectReportsPreset;
    window.onCustomDateInputChanged = onCustomDateInputChanged;
    window.applyReportsDateFilter = applyReportsDateFilter;
    window.filterReportsEventsList = filterReportsEventsList;
    window.openEventStatsModal = openEventStatsModal;
    window.sortReportsEventsBy = sortReportsEventsBy;
    window.handleEventsTableScroll = handleEventsTableScroll;
    window.toggleCompareDropdown = toggleCompareDropdown;
    window.filterCompareDropdownItems = filterCompareDropdownItems;
    window.selectCompareDropdownOption = selectCompareDropdownOption;
})();
