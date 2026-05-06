// 最新の時刻表データ (2026年平日ダイヤ準拠)
const schedules = {
    yatsushiro: [
        { id: "熊本方面", time: "05:07" }, { id: "熊本方面", time: "05:32" }, { id: "熊本方面", time: "05:56" },
        { id: "熊本方面", time: "06:13" }, { id: "熊本方面", time: "06:19" }, { id: "熊本方面", time: "06:32" }, { id: "熊本方面", time: "06:37" }, { id: "熊本方面", time: "06:44" }, { id: "熊本方面", time: "06:51" }, { id: "熊本方面", time: "06:55" },
        { id: "熊本方面", time: "07:04" }, { id: "熊本方面", time: "07:15" }, { id: "熊本方面", time: "07:19" }, { id: "熊本方面", time: "07:33" }, { id: "熊本方面", time: "07:34" }, { id: "熊本方面", time: "07:52" },
        { id: "熊本方面", time: "08:08" }, { id: "熊本方面", time: "08:15" }, { id: "熊本方面", time: "08:31" }, { id: "熊本方面", time: "08:37" }, { id: "熊本方面", time: "08:53" },
        { id: "熊本方面", time: "09:15" }, { id: "熊本方面", time: "09:37" },
        { id: "熊本方面", time: "10:05" }, { id: "熊本方面", time: "10:30" },
        { id: "熊本方面", time: "11:02" }, { id: "熊本方面", time: "11:34" },
        { id: "熊本方面", time: "12:11" }, { id: "熊本方面", time: "12:42" },
        { id: "熊本方面", time: "13:10" }, { id: "熊本方面", time: "13:35" },
        { id: "熊本方面", time: "14:05" }, { id: "熊本方面", time: "14:48" },
        { id: "熊本方面", time: "15:17" }, { id: "熊本方面", time: "15:44" },
        { id: "熊本方面", time: "16:11" }, { id: "熊本方面", time: "16:31" }, { id: "熊本方面", time: "16:54" },
        { id: "熊本方面", time: "17:21" }, { id: "熊本方面", time: "17:40" },
        { id: "熊本方面", time: "18:02" }, { id: "熊本方面", time: "18:21" }, { id: "熊本方面", time: "18:39" },
        { id: "熊本方面", time: "19:00" }, { id: "熊本方面", time: "19:17" }, { id: "熊本方面", time: "19:33" }, { id: "熊本方面", time: "19:54" },
        { id: "熊本方面", time: "20:17" }, { id: "熊本方面", time: "20:46" },
        { id: "熊本方面", time: "21:18" }, { id: "熊本方面", time: "21:51" },
        { id: "熊本方面", time: "22:24" }, { id: "熊本方面", time: "22:58" },
        { id: "熊本方面", time: "23:39" }
    ],
    hisatsuLine: [
        { id: "代行バス", time: "07:15" },
        { id: "代行バス", time: "10:15" },
        { id: "代行バス", time: "12:05" },
        { id: "代行バス", time: "13:45" },
        { id: "代行バス", time: "15:15" },
        { id: "代行バス", time: "17:15" },
        { id: "代行バス", time: "18:10" },
        { id: "代行バス", time: "20:25" }
    ],
    shinkansenUp: [
        { id: "博多行", time: "06:50" }, { id: "博多行", time: "07:27" }, { id: "博多行", time: "07:55" },
        { id: "新大阪行", time: "08:27" }, { id: "新大阪行", time: "08:52" }, { id: "博多行", time: "08:58" },
        { id: "新大阪行", time: "09:28" }, { id: "新大阪行", time: "10:27" }, { id: "博多行", time: "10:48" },
        { id: "新大阪行", time: "11:30" }, { id: "博多行", time: "12:06" }, { id: "博多行", time: "13:06" },
        { id: "新大阪行", time: "13:53" }, { id: "新大阪行", time: "14:31" }, { id: "新大阪行", time: "15:31" },
        { id: "新大阪行", time: "16:31" }, { id: "博多行", time: "17:08" }, { id: "新大阪行", time: "17:53" },
        { id: "博多行", time: "18:50" }, { id: "新大阪行", time: "19:26" }, { id: "博多行", time: "19:44" },
        { id: "博多行", time: "20:19" }, { id: "広島行", time: "20:59" }, { id: "博多行", time: "21:44" },
        { id: "博多行", time: "22:22" }, { id: "博多行", time: "23:05" }, { id: "熊本行", time: "23:46" }
    ],
    shinkansenDown: [
        { id: "鹿児島中央行", time: "06:23" }, { id: "鹿児島中央行", time: "06:46" }, { id: "鹿児島中央行", time: "07:13" },
        { id: "鹿児島中央行", time: "07:43" }, { id: "鹿児島中央行", time: "08:25" }, { id: "鹿児島中央行", time: "08:49" },
        { id: "鹿児島中央行", time: "09:31" }, { id: "鹿児島中央行", time: "10:19" }, { id: "鹿児島中央行", time: "11:29" },
        { id: "鹿児島中央行", time: "11:51" }, { id: "鹿児島中央行", time: "12:52" }, { id: "鹿児島中央行", time: "14:27" },
        { id: "鹿児島中央行", time: "14:52" }, { id: "鹿児島中央行", time: "16:27" }, { id: "鹿児島中央行", time: "17:27" },
        { id: "鹿児島中央行", time: "18:27" }, { id: "鹿児島中央行", time: "18:51" }, { id: "鹿児島中央行", time: "19:55" },
        { id: "鹿児島中央行", time: "20:55" }, { id: "鹿児島中央行", time: "21:55" }, { id: "鹿児島中央行", time: "23:13" }
    ],
    higoKoudaUp: [
        { id: "八代行", time: "06:05" }, { id: "八代行", time: "07:23" }, { id: "八代行", time: "08:13" }, { id: "八代行", time: "08:50" },
        { id: "八代行", time: "11:47" }, { id: "八代行", time: "12:51" },
        { id: "八代行", time: "14:54" }, { id: "八代行", time: "15:49" },
        { id: "八代行", time: "17:00" }, { id: "八代行", time: "18:01" }, { id: "八代行", time: "18:54" },
        { id: "八代行", time: "19:54" },
        { id: "八代行", time: "21:00" }, { id: "八代行", time: "22:15" }
    ],
    higoKoudaDown: [
        { id: "水俣方面", time: "05:53" }, { id: "水俣方面", time: "06:30" }, { id: "水俣方面", time: "07:16" }, { id: "水俣方面", time: "08:03" },
        { id: "水俣方面", time: "09:47" }, { id: "水俣方面", time: "10:03" },
        { id: "水俣方面", time: "12:03" }, { id: "水俣方面", time: "13:24" },
        { id: "水俣方面", time: "15:49" }, { id: "水俣方面", time: "16:48" }, { id: "水俣方面", time: "17:49" },
        { id: "水俣方面", time: "18:55" },
        { id: "水俣方面", time: "20:11" },
        { id: "水俣方面", time: "22:15" }
    ],
    sankoTandai: [
        { id: "八代駅方面", time: "06:46" }, { id: "道の駅たのうら", time: "07:38" }, { id: "八代駅方面", time: "07:41" },
        { id: "道の駅たのうら", time: "08:33" }, { id: "八代駅方面", time: "09:11" }, { id: "道の駅たのうら", time: "09:43" },
        { id: "八代駅方面", time: "10:46" }, { id: "道の駅たのうら", time: "10:48" }, { id: "道の駅たのうら", time: "11:48" },
        { id: "八代駅方面", time: "12:21" }, { id: "道の駅たのうら", time: "13:13" }, { id: "八代駅方面", time: "13:21" },
        { id: "八代駅方面", time: "14:16" }, { id: "道の駅たのうら", time: "14:53" }, { id: "八代駅方面", time: "15:31" },
        { id: "道の駅たのうら", time: "16:13" }, { id: "八代駅方面", time: "16:41" }, { id: "道の駅たのうら", time: "17:33" },
        { id: "道の駅たのうら", time: "18:23" }, { id: "八代駅方面", time: "18:51" }, { id: "道の駅たのうら", time: "20:13" }
    ].sort((a, b) => a.time.localeCompare(b.time)),
    sankoKouda: [
        { id: "日奈久方面", time: "07:04" }, { id: "八代駅方面", time: "07:09" }, { id: "八代駅方面", time: "08:09" },
        { id: "日奈久方面", time: "08:33" }, { id: "八代駅方面", time: "09:39" }, { id: "日奈久方面", time: "10:13" },
        { id: "八代駅方面", time: "11:08" }, { id: "日奈久方面", time: "11:38" }, { id: "八代駅方面", time: "12:38" },
        { id: "日奈久方面", time: "12:59" }, { id: "八代駅方面", time: "13:58" }, { id: "日奈久方面", time: "14:33" },
        { id: "八代駅方面", time: "15:39" }, { id: "日奈久方面", time: "16:46" }, { id: "八代駅方面", time: "17:19" },
        { id: "日奈久方面", time: "17:26" }, { id: "八代駅方面", time: "18:19" }, { id: "日奈久方面", time: "18:26" },
        { id: "日奈久方面", time: "19:09" }
    ].sort((a, b) => a.time.localeCompare(b.time))
};

function parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
    return d;
}

function getCommuteStatus(containerId, diffMins) {
    const iconSafe = '<img src="walk_safe.webp" style="height: 30px; vertical-align: middle; margin-right: 6px; margin-top: -6px;">';
    const iconHurry = '<img src="walk_hurry.webp" style="height: 30px; vertical-align: middle; margin-right: 6px; margin-top: -6px;">';
    const iconImposs = '<img src="walk_impossible.webp" style="height: 30px; vertical-align: middle; margin-right: 6px; margin-top: -6px;">';

    const bikeSafe = '<img src="bike_safe.webp" style="height: 30px; vertical-align: middle; margin-right: 6px; margin-top: -6px;">';
    const bikeHurry = '<img src="bike_hurry.webp" style="height: 30px; vertical-align: middle; margin-right: 6px; margin-top: -6px;">';

    const sSafe = '<span style="color: #10B981;">';
    const sHurry = '<span style="color: #F59E0B;">';
    const sImposs = '<span style="color: #EF4444;">';
    const sEnd = '</span>';

    if (containerId === 'yatsushiro-trains' || containerId === 'hisatsu-line-trains') {
        if (diffMins >= 50) return { text: `${sSafe}${iconSafe}徒歩:余裕${sEnd}<br>${sSafe}${bikeSafe}自転車:余裕${sEnd}`, color: "" };
        if (diffMins >= 45) return { text: `${sHurry}${iconHurry}徒歩:急げば可${sEnd}<br>${sSafe}${bikeSafe}自転車:余裕${sEnd}`, color: "" };
        if (diffMins >= 25) return { text: `${sImposs}${iconImposs}徒歩:不可${sEnd}<br>${sSafe}${bikeSafe}自転車:余裕${sEnd}`, color: "" };
        if (diffMins >= 10) return { text: `${sImposs}${iconImposs}徒歩:不可${sEnd}<br>${sHurry}${bikeHurry}自転車:急げば可${sEnd}`, color: "" };
        return { text: `${sImposs}${iconImposs}徒歩:不可${sEnd}<br>${sImposs}${iconImposs}自転車:不可${sEnd}`, color: "" };
    } else if (containerId === 'shinkansen-up' || containerId === 'shinkansen-down') {
        if (diffMins >= 65) return { text: `${sSafe}${iconSafe}徒歩:余裕${sEnd}<br>${sSafe}${bikeSafe}自転車:余裕${sEnd}`, color: "" };
        if (diffMins >= 60) return { text: `${sHurry}${iconHurry}徒歩:急げば可${sEnd}<br>${sSafe}${bikeSafe}自転車:余裕${sEnd}`, color: "" };
        if (diffMins >= 35) return { text: `${sImposs}${iconImposs}徒歩:不可${sEnd}<br>${sSafe}${bikeSafe}自転車:余裕${sEnd}`, color: "" };
        if (diffMins >= 30) return { text: `${sImposs}${iconImposs}徒歩:不可${sEnd}<br>${sHurry}${bikeHurry}自転車:急げば可${sEnd}`, color: "" };
        return { text: `${sImposs}${iconImposs}徒歩:不可${sEnd}<br>${sImposs}${iconImposs}自転車:不可${sEnd}`, color: "" };
    } else if (containerId === 'higo-kouda-up-trains' || containerId === 'higo-kouda-down-trains' || containerId === 'sanko-kouda-bus') {
        if (diffMins >= 15) return { text: `${sSafe}${iconSafe}徒歩:余裕${sEnd}<br>${sSafe}${bikeSafe}自転車:余裕${sEnd}`, color: "" };
        if (diffMins >= 12) return { text: `${sHurry}${iconHurry}徒歩:急げば可${sEnd}<br>${sSafe}${bikeSafe}自転車:余裕${sEnd}`, color: "" };
        if (diffMins >= 8) return { text: `${sImposs}${iconImposs}徒歩:不可${sEnd}<br>${sSafe}${bikeSafe}自転車:余裕${sEnd}`, color: "" };
        if (diffMins >= 6) return { text: `${sImposs}${iconImposs}徒歩:不可${sEnd}<br>${sHurry}${bikeHurry}自転車:急げば可${sEnd}`, color: "" };
        return { text: `${sImposs}${iconImposs}徒歩:不可${sEnd}<br>${sImposs}${iconImposs}自転車:不可${sEnd}`, color: "" };
    } else if (containerId === 'sanko-tandai-bus') {
        if (diffMins >= 15) return { text: `${sSafe}${iconSafe}徒歩:余裕${sEnd}`, color: "" };
        if (diffMins >= 12) return { text: `${sHurry}${iconHurry}徒歩:急げば可${sEnd}`, color: "" };
        return { text: `${sImposs}${iconImposs}徒歩:不可${sEnd}`, color: "" };
    }
    return { text: "", color: "" };
}

function updateTrains() {
    const now = new Date();
    
    // Update clock
    document.getElementById('current-time').textContent = now.toLocaleTimeString('ja-JP');

    // Calculate dynamic max trains based on viewport height to prevent overflow
    // Extremely conservative estimate: 450px for all headers/padding/logos, and 100px per train item
    const availableHeight = window.innerHeight - 450;
    const dynamicMaxTrains = Math.max(1, Math.floor(availableHeight / 100));

    function renderSchedule(containerId, scheduleArray) {
        const container = document.getElementById(containerId);
        const card = container.closest('.time-card');
        container.innerHTML = '';

        // Find next trains
        let nextTrains = [];
        for (const train of scheduleArray) {
            const trainTime = parseTime(train.time);
            if (trainTime >= now) {
                nextTrains.push({ id: train.id, timeStr: train.time, date: trainTime });
            }
        }

        if (nextTrains.length === 0) {
            container.innerHTML = '<div class="no-train">本日の運行は終了しました</div>';
            return;
        }

        // Check if the card is currently visible
        const isVisible = card.style.display !== 'none' && card.offsetWidth > 0;
        // Generic fallback max for hidden cards
        const genericMax = Math.max(2, Math.floor((window.innerHeight - 300) / 95));

        for (let i = 0; i < nextTrains.length; i++) {
            // For hidden cards, fall back to a safe generic max limit
            if (!isVisible && i >= genericMax) {
                break;
            }

            const train = nextTrains[i];
            const diffMs = train.date - now;
            const diffMins = Math.floor(diffMs / 60000);
            
            const item = document.createElement('div');
            item.className = 'train-item';
            
            const status = getCommuteStatus(containerId, diffMins);

            // Highlight if the status is impossible (Red)
            if (status && status.color === '#EF4444') {
                item.classList.add('soon');
            }

            let timeLeftText = '';
            if (diffMins === 0) {
                timeLeftText = 'まもなく';
            } else if (diffMins < 60) {
                timeLeftText = `あと${diffMins}分`;
            } else {
                const h = Math.floor(diffMins / 60);
                const m = diffMins % 60;
                timeLeftText = `あと${h}時間${m}分`;
            }

            let isLast = false;
            if (containerId === 'hisatsu-line-trains') {
                if (scheduleArray[scheduleArray.length - 1].time === train.timeStr) {
                    isLast = true;
                }
            } else {
                for (let i = scheduleArray.length - 1; i >= 0; i--) {
                    if (scheduleArray[i].id === train.id) {
                        if (scheduleArray[i].time === train.timeStr) {
                            isLast = true;
                        }
                        break;
                    }
                }
            }

            const badgeHtml = isLast ? '<span class="last-train-badge">最終便</span>' : '';
            const statusHtml = status ? `<div style="font-size: 1.4rem; font-weight: bold; color: ${status.color || 'inherit'}; margin-top: 8px; text-align: right;">${status.text}</div>` : '';

            item.innerHTML = `
                <div class="train-time">
                    <span class="train-id">${train.id}</span>
                    <span class="train-clock">${train.timeStr} 発 ${badgeHtml}</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <div class="time-left">${timeLeftText}</div>
                    ${statusHtml}
                </div>
            `;
            container.appendChild(item);

            // If the card is visible, immediately measure it. If it causes overflow, remove it and stop!
            if (isVisible) {
                // We leave a 40px margin at the bottom of the screen
                if (card.getBoundingClientRect().bottom > window.innerHeight - 40) {
                    container.removeChild(item);
                    break;
                }
            }
        }
    }

    renderSchedule('yatsushiro-trains', schedules.yatsushiro);
    renderSchedule('hisatsu-line-trains', schedules.hisatsuLine);
    renderSchedule('shinkansen-up', schedules.shinkansenUp);
    renderSchedule('shinkansen-down', schedules.shinkansenDown);
    renderSchedule('higo-kouda-up-trains', schedules.higoKoudaUp);
    renderSchedule('higo-kouda-down-trains', schedules.higoKoudaDown);
    renderSchedule('sanko-tandai-bus', schedules.sankoTandai);
    renderSchedule('sanko-kouda-bus', schedules.sankoKouda);
}

// Initial update and set interval
updateTrains();
setInterval(updateTrains, 1000);
