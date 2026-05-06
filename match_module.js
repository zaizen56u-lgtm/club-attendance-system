const express = require('express');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const router = express.Router();

// グローバルな試合状態（メモリ上に保存）
let matchState = {
    elapsedTime: 0,
    targetTime: 180, // 3 mins default
    isRunning: false,
    scoreLeft: 0,
    scoreRight: 0,
    points: { movingBucket: 100, flag: 100, deskDrawer: 20, edgeBucket: 5, centerBucket: 1, allSpots: 100 },
    limits: { allSpots: 1 },
    itemNames: { movingBucket: '移動バケツ', flag: '旗', deskDrawer: '机引き出し', edgeBucket: '両端のバケツ', centerBucket: '中央バケツ', allSpots: '全ての得点スポットに得点' },
    breakdownLeft: { movingBucket: 0, flag: 0, deskDrawer: 0, edgeBucket: 0, centerBucket: 0, allSpots: 0 },
    chatMessages: [], 
    presetMessages: ['得点確認お願いします', '機材トラブル発生', 'ロボット停止', 'タイムアウト要求'],
    retryStatusLeft: null,
    retryStatusRight: null,
    penaltyTimerLeft: 0,
    penaltyTimerRight: 0,
    nameLeft: '沖縄工業高等専門学校 Aチーム',
    nameRight: '鹿児島工業高等専門学校 Aチーム',
    teamList: [
        '沖縄工業高等専門学校 Aチーム', '沖縄工業高等専門学校 Bチーム',
        '鹿児島工業高等専門学校 Aチーム', '鹿児島工業高等専門学校 Bチーム',
        '都城工業高等専門学校 Aチーム', '都城工業高等専門学校 Bチーム',
        '大分工業高等専門学校 Aチーム', '大分工業高等専門学校 Bチーム',
        '熊本高等専門学校 八代キャンパス Aチーム', '熊本高等専門学校 八代キャンパス Bチーム',
        '熊本高等専門学校 熊本キャンパス Aチーム', '熊本高等専門学校 熊本キャンパス Bチーム',
        '佐世保工業高等専門学校 Aチーム', '佐世保工業高等専門学校 Bチーム',
        '北九州工業高等専門学校 Aチーム', '北九州工業高等専門学校 Bチーム',
        '有明工業高等専門学校 Aチーム', '有明工業高等専門学校 Bチーム',
        '久留米工業高等専門学校 Aチーム', '久留米工業高等専門学校 Bチーム',
        '高知工業高等専門学校 Aチーム', '高知工業高等専門学校 Bチーム',
        '弓削商船高等専門学校 Aチーム', '弓削商船高等専門学校 Bチーム',
        '新居浜工業高等専門学校 Aチーム', '新居浜工業高等専門学校 Bチーム',
        '香川高等専門学校 詫間キャンパス Aチーム', '香川高等専門学校 詫間キャンパス Bチーム',
        '香川高等専門学校 高松キャンパス Aチーム', '香川高等専門学校 高松キャンパス Bチーム',
        '阿南工業高等専門学校 Aチーム', '阿南工業高等専門学校 Bチーム',
        '大島商船高等専門学校 Aチーム', '大島商船高等専門学校 Bチーム',
        '宇部工業高等専門学校 Aチーム', '宇部工業高等専門学校 Bチーム',
        '徳山工業高等専門学校 Aチーム', '徳山工業高等専門学校 Bチーム',
        '呉工業高等専門学校 Aチーム', '呉工業高等専門学校 Bチーム',
        '広島商船高等専門学校 Aチーム', '広島商船高等専門学校 Bチーム',
        '津山工業高等専門学校 Aチーム', '津山工業高等専門学校 Bチーム',
        '松江工業高等専門学校 Aチーム', '松江工業高等専門学校 Bチーム',
        '米子工業高等専門学校 Aチーム', '米子工業高等専門学校 Bチーム',
        '和歌山工業高等専門学校 Aチーム', '和歌山工業高等専門学校 Bチーム',
        '奈良工業高等専門学校 Aチーム', '奈良工業高等専門学校 Bチーム',
        '明石工業高等専門学校 Aチーム', '明石工業高等専門学校 Bチーム',
        '舞鶴工業高等専門学校 Aチーム', '舞鶴工業高等専門学校 Bチーム',
        '鈴鹿工業高等専門学校 Aチーム', '鈴鹿工業高等専門学校 Bチーム',
        '鳥羽商船高等専門学校 Aチーム', '鳥羽商船高等専門学校 Bチーム',
        '豊田工業高等専門学校 Aチーム', '豊田工業高等専門学校 Bチーム',
        '沼津工業高等専門学校 Aチーム', '沼津工業高等専門学校 Bチーム',
        '岐阜工業高等専門学校 Aチーム', '岐阜工業高等専門学校 Bチーム',
        '福井工業高等専門学校 Aチーム', '福井工業高等専門学校 Bチーム',
        '石川工業高等専門学校 Aチーム', '石川工業高等専門学校 Bチーム',
        '富山高等専門学校 射水キャンパス Aチーム', '富山高等専門学校 射水キャンパス Bチーム',
        '富山高等専門学校 本郷キャンパス Aチーム', '富山高等専門学校 本郷キャンパス Bチーム',
        '長野工業高等専門学校 Aチーム', '長野工業高等専門学校 Bチーム',
        '長岡工業高等専門学校 Aチーム', '長岡工業高等専門学校 Bチーム',
        '東京工業高等専門学校 Aチーム', '東京工業高等専門学校 Bチーム',
        '木更津工業高等専門学校 Aチーム', '木更津工業高等専門学校 Bチーム',
        '群馬工業高等専門学校 Aチーム', '群馬工業高等専門学校 Bチーム',
        '小山工業高等専門学校 Aチーム', '小山工業高等専門学校 Bチーム',
        '茨城工業高等専門学校 Aチーム', '茨城工業高等専門学校 Bチーム',
        '福島工業高等専門学校 Aチーム', '福島工業高等専門学校 Bチーム',
        '鶴岡工業高等専門学校 Aチーム', '鶴岡工業高等専門学校 Bチーム',
        '秋田工業高等専門学校 Aチーム', '秋田工業高等専門学校 Bチーム',
        '仙台高等専門学校 名取キャンパス Aチーム', '仙台高等専門学校 名取キャンパス Bチーム',
        '仙台高等専門学校 広瀬キャンパス Aチーム', '仙台高等専門学校 広瀬キャンパス Bチーム',
        '一関工業高等専門学校 Aチーム', '一関工業高等専門学校 Bチーム',
        '八戸工業高等専門学校 Aチーム', '八戸工業高等専門学校 Bチーム',
        '旭川工業高等専門学校 Aチーム', '旭川工業高等専門学校 Bチーム',
        '釧路工業高等専門学校 Aチーム', '釧路工業高等専門学校 Bチーム',
        '苫小牧工業高等専門学校 Aチーム', '苫小牧工業高等専門学校 Bチーム',
        '苫小牧工業高等専門学校 Aチーム', '苫小牧工業高等専門学校 Bチーム',
        '函館工業高等専門学校 Aチーム', '函館工業高等専門学校 Bチーム'
    ],
    winner: 'none', // 'left', 'right', 'none'
    history: [],
    countdownTriggerId: 0,
    isCountingDown: false
};

let timerInterval = null;

function startTimer() {
    if (timerInterval) return;
    matchState.isRunning = true;
    timerInterval = setInterval(() => {
        matchState.elapsedTime++;
        
        if (matchState.penaltyTimerLeft > 0) {
            matchState.penaltyTimerLeft--;
            if (matchState.penaltyTimerLeft === 0 && matchState.retryStatusLeft === '強制リトライ') {
                matchState.retryStatusLeft = null;
            }
        }
        if (matchState.penaltyTimerRight > 0) {
            matchState.penaltyTimerRight--;
            if (matchState.penaltyTimerRight === 0 && matchState.retryStatusRight === '強制リトライ') {
                matchState.retryStatusRight = null;
            }
        }
        
        if (matchState.targetTime > 0 && matchState.elapsedTime >= matchState.targetTime) {
            stopTimer();
            // 自動勝敗判定
            if (matchState.scoreLeft > matchState.scoreRight) matchState.winner = 'left';
            else if (matchState.scoreRight > matchState.scoreLeft) matchState.winner = 'right';
            else matchState.winner = 'tie';
        }
    }, 1000);
}

function stopTimer() {
    matchState.isRunning = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// 状態取得API (ボード側、管理側が定期的に呼び出す)
router.get('/api/state', (req, res) => {
    res.json(matchState);
});

// 操作API (管理側から呼び出す)
router.post('/api/action', (req, res) => {
    const { action, payload } = req.body;
    
    switch (action) {
        case 'START':
            startTimer();
            break;
        case 'COUNTDOWN_START':
            if (matchState.isRunning || matchState.isCountingDown) break;
            matchState.isCountingDown = true;
            matchState.countdownTriggerId++;
            setTimeout(() => {
                matchState.isCountingDown = false;
                startTimer();
            }, 3000);
            break;
        case 'SAVE_RESULTS': {
            const resultsDir = path.join(__dirname, 'results');
            if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);

            const timestamp = new Date().toLocaleString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }).replace(/[\/\:]/g, '-').replace(' ', '_');
            const sheetName = timestamp.substring(0, 31); // max 31 chars
            
            const getRegion = (teamName) => {
                const t = teamName;
                if (t.includes('熊本')) return '自校チーム';
                if (t.includes('旭川') || t.includes('釧路') || t.includes('苫小牧') || t.includes('函館')) return '北海道地区';
                if (t.includes('八戸') || t.includes('一関') || t.includes('仙台') || t.includes('秋田') || t.includes('鶴岡') || t.includes('福島')) return '東北地区';
                if (t.includes('茨城') || t.includes('小山') || t.includes('群馬') || t.includes('木更津') || t.includes('東京') || t.includes('長岡') || t.includes('長野')) return '関東信越地区';
                if (t.includes('富山') || t.includes('石川') || t.includes('福井') || t.includes('岐阜') || t.includes('沼津') || t.includes('豊田') || t.includes('鳥羽') || t.includes('鈴鹿')) return '東海北陸地区';
                if (t.includes('舞鶴') || t.includes('明石') || t.includes('奈良') || t.includes('和歌山')) return '近畿地区';
                if (t.includes('米子') || t.includes('松江') || t.includes('津山') || t.includes('広島') || t.includes('呉') || t.includes('徳山') || t.includes('宇部') || t.includes('大島')) return '中国地区';
                if (t.includes('阿南') || t.includes('香川') || t.includes('新居浜') || t.includes('弓削') || t.includes('高知')) return '四国地区';
                if (t.includes('久留米') || t.includes('有明') || t.includes('北九州') || t.includes('佐世保') || t.includes('大分') || t.includes('都城') || t.includes('鹿児島') || t.includes('沖縄')) return '九州沖縄地区';
                return 'その他';
            };

            const createNewWorkbookWithExplanation = () => {
                const wb = xlsx.utils.book_new();
                const explanationData = [
                    ["【このファイルの見方と使い方】"],
                    [""],
                    ["このファイルには、本チームが行った試合・練習の得点履歴が新しいシートとして随時追加されていきます。"],
                    ["各シートの名前は「練習〇回目」になっています。"],
                    ["1つのファイルに50回分の記録がたまると、自動的に新しいファイルが作成されます。"],
                    [""],
                    ["■ 各項目の説明"],
                    ["経過時間", "試合開始から何分何秒の時点で得点が入ったかを示します。（例: 0:15 = 15秒）"],
                    ["得点の種類", "どの得点アクションが実行されたかを示します。（例: 移動バケツ）"],
                    ["回数", "そのタイミング（1秒以内の連続入力を含む）で何回得点が入ったかを示します。"],
                    ["点数", "そのアクションによって加算（または減算）された点数です。"],
                    ["累積点数", "その得点が入った直後における、このチームの総得点です。"],
                    [""],
                    ["■ 記録の例"],
                    ["経過時間", "得点の種類", "回数", "点数", "累積点数"],
                    ["0:05", "移動バケツ", "1回", "+100", "100"],
                    ["0:12", "机引き出し", "2回", "+40", "140"],
                    ["3:00", "最終結果", "", "", "140"]
                ];
                const ws = xlsx.utils.aoa_to_sheet(explanationData);
                ws['!cols'] = [ { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 } ];
                xlsx.utils.book_append_sheet(wb, ws, "見方と使い方");
                return wb;
            };

            const saveForTeam = (teamName, data, totalScore) => {
                const region = getRegion(teamName);
                const safeName = teamName.replace(/[\\/:*?"<>|]/g, '');
                const teamDir = path.join(resultsDir, region, safeName);
                if (!fs.existsSync(teamDir)) fs.mkdirSync(teamDir, { recursive: true });
                
                let fileIndex = 1;
                const files = fs.readdirSync(teamDir);
                for (const f of files) {
                    const match = f.match(new RegExp(`^${safeName} 練習_(\\d+)～\\d+回\\.xlsx$`));
                    if (match) {
                        const startIdx = parseInt(match[1], 10);
                        const idx = Math.floor((startIdx - 1) / 50) + 1;
                        if (idx > fileIndex) fileIndex = idx;
                    }
                }
                
                let startLimit = (fileIndex - 1) * 50 + 1;
                let endLimit = fileIndex * 50;
                let fileName = `${safeName} 練習_${startLimit}～${endLimit}回.xlsx`;
                let filePath = path.join(teamDir, fileName);
                
                let wb;
                if (fs.existsSync(filePath)) {
                    wb = xlsx.readFile(filePath);
                    if (wb.SheetNames.length >= 51) { // 50 practices + 1 explanation sheet
                        fileIndex++;
                        startLimit = (fileIndex - 1) * 50 + 1;
                        endLimit = fileIndex * 50;
                        fileName = `${safeName} 練習_${startLimit}～${endLimit}回.xlsx`;
                        filePath = path.join(teamDir, fileName);
                        wb = createNewWorkbookWithExplanation();
                    }
                } else {
                    wb = createNewWorkbookWithExplanation();
                }
                
                const practiceNumber = (fileIndex - 1) * 50 + wb.SheetNames.length;
                const sheetName = `練習${practiceNumber}回目`;
                
                const exportData = data.map(row => {
                    const m = Math.floor(row.time / 60);
                    const s = (row.time % 60).toString().padStart(2, '0');
                    return {
                        '経過時間': `${m}:${s}`,
                        '得点の種類': row.action,
                        '回数': (row.count || 1) + '回',
                        '点数': row.change,
                        '累積点数': row.team === matchState.nameLeft ? row.leftTotal : row.rightTotal
                    };
                });
                
                exportData.push({ '経過時間': '最終結果', '得点の種類': '', '回数': '', '点数': '', '累積点数': totalScore });
                const ws = xlsx.utils.json_to_sheet(exportData);
                
                xlsx.utils.book_append_sheet(wb, ws, sheetName);
                xlsx.writeFile(wb, filePath);
            };

            const dataLeft = matchState.history.filter(h => h.team === matchState.nameLeft);
            saveForTeam(matchState.nameLeft, dataLeft, matchState.scoreLeft);
            
            if (matchState.nameLeft !== matchState.nameRight) {
                const dataRight = matchState.history.filter(h => h.team === matchState.nameRight);
                saveForTeam(matchState.nameRight, dataRight, matchState.scoreRight);
            }
            break;
        }
        case 'PAUSE':
            stopTimer();
            break;
        case 'RESET':
            stopTimer();
            matchState.elapsedTime = 0;
            matchState.winner = 'none';
            break;
        case 'RESET_SCORE':
            matchState.scoreLeft = 0;
            matchState.scoreRight = 0;
            matchState.breakdownLeft = {};
            matchState.breakdownRight = {};
            Object.keys(matchState.points).forEach(k => {
                matchState.breakdownLeft[k] = 0;
                matchState.breakdownRight[k] = 0;
            });
            matchState.winner = 'none';
            matchState.history = [];
            break;
        case 'SEND_CHAT':
            matchState.chatMessages.push({
                time: new Date().toISOString(),
                sender: payload.sender,
                message: payload.message
            });
            if (matchState.chatMessages.length > 200) {
                matchState.chatMessages.shift();
            }
            break;
        case 'UPDATE_PRESETS':
            matchState.presetMessages = payload;
            break;
        case 'SET_RETRY':
            if (payload.team === 'left') {
                matchState.retryStatusLeft = payload.type;
                if (payload.type === '強制リトライ') matchState.penaltyTimerLeft = 15;
            } else {
                matchState.retryStatusRight = payload.type;
                if (payload.type === '強制リトライ') matchState.penaltyTimerRight = 15;
            }
            break;
        case 'CLEAR_RETRY':
            if (payload.team === 'left') {
                matchState.retryStatusLeft = null;
                matchState.penaltyTimerLeft = 0;
            } else {
                matchState.retryStatusRight = null;
                matchState.penaltyTimerRight = 0;
            }
            break;
        case 'RESET_MATCH':
            stopTimer();
            matchState.elapsedTime = 0;
            matchState.scoreLeft = 0;
            matchState.scoreRight = 0;
            matchState.breakdownLeft = {};
            matchState.breakdownRight = {};
            matchState.retryStatusLeft = null;
            matchState.retryStatusRight = null;
            matchState.penaltyTimerLeft = 0;
            matchState.penaltyTimerRight = 0;
            Object.keys(matchState.points).forEach(k => {
                matchState.breakdownLeft[k] = 0;
                matchState.breakdownRight[k] = 0;
            });
            matchState.winner = 'none';
            matchState.history = [];
            break;
        case 'UPDATE_BREAKDOWN':
            const teamBd = payload.team === 'left' ? matchState.breakdownLeft : matchState.breakdownRight;
            if (teamBd[payload.item] === undefined) teamBd[payload.item] = 0;
            const previousValue = teamBd[payload.item];
            teamBd[payload.item] = Math.max(0, teamBd[payload.item] + payload.change);
            if (matchState.limits && matchState.limits[payload.item] !== undefined) {
                teamBd[payload.item] = Math.min(matchState.limits[payload.item], teamBd[payload.item]);
            }
            const actualChange = teamBd[payload.item] - previousValue;

            const calcScore = (b) => {
                return Object.keys(matchState.points).reduce((sum, key) => sum + ((b[key] || 0) * matchState.points[key]), 0);
            };
            matchState.scoreLeft = calcScore(matchState.breakdownLeft);
            matchState.scoreRight = calcScore(matchState.breakdownRight);

            if (actualChange !== 0 && matchState.points[payload.item] !== undefined) {
                const teamName = payload.team === 'left' ? matchState.nameLeft : matchState.nameRight;
                const actionName = matchState.itemNames[payload.item] || payload.item;
                const scoreDelta = actualChange * matchState.points[payload.item];
                
                // 直近の入力からの間隔が1秒以内ならコンボとしてまとめる
                let targetEntry = null;
                for (let i = matchState.history.length - 1; i >= 0; i--) {
                    const entry = matchState.history[i];
                    // そのエントリーの「最終更新時間」から1秒以上経過していたらもう繋げない
                    if (matchState.elapsedTime - (entry.lastUpdateTime || entry.time) > 1) {
                        break; 
                    }
                    if (entry.team === teamName && entry.action === actionName) {
                        targetEntry = entry;
                        break;
                    }
                }

                if (targetEntry) {
                    // まとめる (表示される時間は最初の時間のまま、最終更新時間だけ更新)
                    targetEntry.count = (targetEntry.count || 0) + actualChange;
                    targetEntry.changeRaw = (targetEntry.changeRaw || parseInt(targetEntry.change.toString().replace('+', ''), 10)) + scoreDelta;
                    targetEntry.change = (targetEntry.changeRaw > 0 ? '+' : '') + targetEntry.changeRaw;
                    targetEntry.leftTotal = matchState.scoreLeft;
                    targetEntry.rightTotal = matchState.scoreRight;
                    targetEntry.lastUpdateTime = matchState.elapsedTime;
                } else {
                    // 新規追加
                    matchState.history.push({
                        time: matchState.elapsedTime,
                        lastUpdateTime: matchState.elapsedTime, // コンボ判定用
                        team: teamName,
                        action: actionName,
                        count: actualChange,
                        changeRaw: scoreDelta,
                        change: (scoreDelta > 0 ? '+' : '') + scoreDelta,
                        leftTotal: matchState.scoreLeft,
                        rightTotal: matchState.scoreRight
                    });
                }
            }
            break;
        case 'UPDATE_POINTS':
        case 'UPDATE_RULES':
            matchState.points = payload.points || {};
            matchState.itemNames = payload.itemNames || {};
            matchState.limits = payload.limits || {};
            
            // 新しい項目があれば0で初期化、古い項目を削除
            const newBdL = {};
            const newBdR = {};
            Object.keys(matchState.points).forEach(k => {
                newBdL[k] = matchState.breakdownLeft[k] || 0;
                newBdR[k] = matchState.breakdownRight[k] || 0;
            });
            matchState.breakdownLeft = newBdL;
            matchState.breakdownRight = newBdR;

            const recalc = (b) => {
                return Object.keys(matchState.points).reduce((sum, key) => sum + ((b[key] || 0) * matchState.points[key]), 0);
            };
            matchState.scoreLeft = recalc(matchState.breakdownLeft);
            matchState.scoreRight = recalc(matchState.breakdownRight);
            break;
        case 'UPDATE_TEAM_LIST':
            matchState.teamList = payload;
            break;
        case 'SET_TARGET':
            matchState.targetTime = payload;
            break;
        case 'SCORE_LEFT':
            matchState.scoreLeft = Math.max(0, matchState.scoreLeft + payload);
            break;
        case 'SCORE_RIGHT':
            matchState.scoreRight = Math.max(0, matchState.scoreRight + payload);
            break;
        case 'SET_NAME_LEFT':
            matchState.nameLeft = payload;
            break;
        case 'SET_NAME_RIGHT':
            matchState.nameRight = payload;
            break;
        case 'JUDGE':
            if (matchState.scoreLeft > matchState.scoreRight) matchState.winner = 'left';
            else if (matchState.scoreRight > matchState.scoreLeft) matchState.winner = 'right';
            else matchState.winner = 'none';
            break;
        case 'CLEAR_JUDGE':
            matchState.winner = 'none';
            break;
    }
    
    res.json(matchState);
});

// Start server
function initMatchSystem() {
    
    // 初期化時に全チームのExcelファイルを作成
    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir);
    }
    
    // 不要になったルートのExcelファイルを削除 (整理用)
    const files = fs.readdirSync(resultsDir);
    for (const file of files) {
        if (file.endsWith('.xlsx')) {
            fs.unlinkSync(path.join(resultsDir, file));
        }
    }
    
    const getRegion = (teamName) => {
        const t = teamName;
        if (t.includes('熊本')) return '自校チーム';
        if (t.includes('旭川') || t.includes('釧路') || t.includes('苫小牧') || t.includes('函館')) return '北海道地区';
        if (t.includes('八戸') || t.includes('一関') || t.includes('仙台') || t.includes('秋田') || t.includes('鶴岡') || t.includes('福島')) return '東北地区';
        if (t.includes('茨城') || t.includes('小山') || t.includes('群馬') || t.includes('木更津') || t.includes('東京') || t.includes('長岡') || t.includes('長野')) return '関東信越地区';
        if (t.includes('富山') || t.includes('石川') || t.includes('福井') || t.includes('岐阜') || t.includes('沼津') || t.includes('豊田') || t.includes('鳥羽') || t.includes('鈴鹿')) return '東海北陸地区';
        if (t.includes('舞鶴') || t.includes('明石') || t.includes('奈良') || t.includes('和歌山')) return '近畿地区';
        if (t.includes('米子') || t.includes('松江') || t.includes('津山') || t.includes('広島') || t.includes('呉') || t.includes('徳山') || t.includes('宇部') || t.includes('大島')) return '中国地区';
        if (t.includes('阿南') || t.includes('香川') || t.includes('新居浜') || t.includes('弓削') || t.includes('高知')) return '四国地区';
        if (t.includes('久留米') || t.includes('有明') || t.includes('北九州') || t.includes('佐世保') || t.includes('大分') || t.includes('都城') || t.includes('鹿児島') || t.includes('沖縄')) return '九州沖縄地区';
        return 'その他';
    };

    matchState.teamList.forEach(team => {
        const region = getRegion(team);
        const safeName = team.replace(/[\\/:*?"<>|]/g, '');
        const teamDir = path.join(resultsDir, region, safeName);
        if (!fs.existsSync(teamDir)) fs.mkdirSync(teamDir, { recursive: true });
        
        const filePath = path.join(teamDir, `${safeName} 練習_1～50回.xlsx`);
        if (!fs.existsSync(filePath)) {
            const wb = xlsx.utils.book_new();
            
            const explanationData = [
                ["【このファイルの見方と使い方】"],
                [""],
                ["このファイルには、本チームが行った試合・練習の得点履歴が新しいシートとして随時追加されていきます。"],
                ["各シートの名前は「練習〇回目」になっています。"],
                ["1つのファイルに50回分の記録がたまると、自動的に新しいファイルが作成されます。"],
                [""],
                ["■ 各項目の説明"],
                ["経過時間", "試合開始から何分何秒の時点で得点が入ったかを示します。（例: 0:15 = 15秒）"],
                ["得点の種類", "どの得点アクションが実行されたかを示します。（例: 移動バケツ）"],
                ["回数", "そのタイミング（1秒以内の連続入力を含む）で何回得点が入ったかを示します。"],
                ["点数", "そのアクションによって加算（または減算）された点数です。"],
                ["累積点数", "その得点が入った直後における、このチームの総得点です。"],
                [""],
                ["■ 記録の例"],
                ["経過時間", "得点の種類", "回数", "点数", "累積点数"],
                ["0:05", "移動バケツ", "1回", "+100", "100"],
                ["0:12", "机引き出し", "2回", "+40", "140"],
                ["3:00", "最終結果", "", "", "140"]
            ];
            
            const ws = xlsx.utils.aoa_to_sheet(explanationData);
            
            // 列幅を設定
            ws['!cols'] = [
                { wch: 15 }, // 経過時間
                { wch: 20 }, // 得点の種類
                { wch: 10 }, // 回数
                { wch: 15 }, // 点数
                { wch: 15 }  // 累積点数
            ];
            
            xlsx.utils.book_append_sheet(wb, ws, "見方と使い方");
            xlsx.writeFile(wb, filePath);
        }
    });
}

module.exports = { router, initMatchSystem };
