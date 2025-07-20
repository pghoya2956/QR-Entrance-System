// 전역 변수
let charts = {};
let currentEventId = null;
let analyticsInterval = null;

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    currentEventId = localStorage.getItem('selectedEventId') || null;
    
    // 이벤트 목록 로드
    await loadEventOptions();
    
    // 통계 초기화
    await initializeAnalytics();
    
    // 5초마다 자동 새로고침
    analyticsInterval = setInterval(() => {
        refreshAnalytics();
    }, 5000);
});

// 이벤트 옵션 로드
async function loadEventOptions() {
    try {
        const response = await fetch(getApiUrl('/api/events'));
        if (response.ok) {
            const events = await response.json();
            const selectElement = document.getElementById('eventSelect');
            
            selectElement.innerHTML = '<option value="">이벤트 선택</option>';
            events.forEach(event => {
                const option = document.createElement('option');
                option.value = event.eventId;
                option.textContent = event.eventName;
                if (event.eventId === currentEventId) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });
        }
    } catch (error) {
        console.error('이벤트 목록 로드 실패:', error);
    }
}

// 이벤트 변경 처리
function handleEventChange() {
    const selectElement = document.getElementById('eventSelect');
    const eventId = selectElement.value;
    
    if (eventId) {
        currentEventId = eventId;
        localStorage.setItem('selectedEventId', eventId);
        refreshAnalytics();
    }
}

// 통계 초기화
async function initializeAnalytics() {
    // 차트 초기화
    initializeCharts();
    
    // 통계 로드
    await loadAnalyticsData();
}

// 통계 데이터 로드
async function loadAnalyticsData() {
    if (!currentEventId) {
        showToast('이벤트를 선택해주세요', 'warning');
        return;
    }
    
    try {
        // 통계 데이터 가져오기
        const statsResponse = await fetch(getApiUrl(`/api/admin/stats?event_id=${currentEventId}`));
        const stats = await statsResponse.json();
        
        // 통계 카드 업데이트
        updateStatCards(stats);
        
        // 참가자 목록 가져오기
        const attendeesResponse = await fetch(getApiUrl(`/api/admin/attendees?event_id=${currentEventId}`));
        const attendees = await attendeesResponse.json();
        
        // 차트 업데이트
        updateCharts(attendees);
        
        // 최근 체크인 목록 업데이트
        updateRecentCheckins(attendees);
        
    } catch (error) {
        console.error('통계 데이터 로드 실패:', error);
        showToast('통계 데이터를 불러올 수 없습니다', 'error');
    }
}

// 통계 카드 업데이트
function updateStatCards(stats) {
    document.getElementById('totalCount').textContent = stats.total || 0;
    document.getElementById('checkedInCount').textContent = stats.checkedIn || 0;
    document.getElementById('notCheckedInCount').textContent = (stats.total - stats.checkedIn) || 0;
    
    const rate = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;
    document.getElementById('attendanceRate').textContent = rate + '%';
}

// 차트 초기화
function initializeCharts() {
    // 체크인 현황 도넛 차트
    const checkinCtx = document.getElementById('checkinChart').getContext('2d');
    charts.checkin = new Chart(checkinCtx, {
        type: 'doughnut',
        data: {
            labels: ['체크인', '미체크인'],
            datasets: [{
                data: [0, 0],
                backgroundColor: [
                    'rgb(16, 185, 129)',
                    'rgb(229, 231, 235)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // 시간대별 체크인 차트
    const timelineCtx = document.getElementById('timelineChart').getContext('2d');
    charts.timeline = new Chart(timelineCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '체크인 수',
                data: [],
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
    
    // 참가 유형별 차트
    const typeCtx = document.getElementById('typeChart').getContext('2d');
    charts.type = new Chart(typeCtx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgb(99, 102, 241)',
                    'rgb(34, 197, 94)',
                    'rgb(249, 115, 22)',
                    'rgb(236, 72, 153)',
                    'rgb(107, 114, 128)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // 회사별 차트
    const companyCtx = document.getElementById('companyChart').getContext('2d');
    charts.company = new Chart(companyCtx, {
        type: 'horizontalBar',
        data: {
            labels: [],
            datasets: [{
                label: '참가자 수',
                data: [],
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// 차트 업데이트
function updateCharts(attendees) {
    // 체크인 현황
    const checkedIn = attendees.filter(a => a['체크인여부'] === 1).length;
    const notCheckedIn = attendees.length - checkedIn;
    
    charts.checkin.data.datasets[0].data = [checkedIn, notCheckedIn];
    charts.checkin.update();
    
    // 시간대별 체크인
    const hourlyData = {};
    attendees.filter(a => a['체크인시간']).forEach(attendee => {
        const hour = new Date(attendee['체크인시간']).getHours();
        hourlyData[hour] = (hourlyData[hour] || 0) + 1;
    });
    
    const hours = Object.keys(hourlyData).sort((a, b) => a - b);
    charts.timeline.data.labels = hours.map(h => `${h}시`);
    charts.timeline.data.datasets[0].data = hours.map(h => hourlyData[h]);
    charts.timeline.update();
    
    // 참가 유형별
    const typeData = {};
    attendees.forEach(attendee => {
        const type = attendee['초대/현장방문'] || '미분류';
        typeData[type] = (typeData[type] || 0) + 1;
    });
    
    charts.type.data.labels = Object.keys(typeData);
    charts.type.data.datasets[0].data = Object.values(typeData);
    charts.type.update();
    
    // 회사별 TOP 10
    const companyData = {};
    attendees.forEach(attendee => {
        const company = attendee['회사명'] || '미입력';
        companyData[company] = (companyData[company] || 0) + 1;
    });
    
    const topCompanies = Object.entries(companyData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    charts.company.data.labels = topCompanies.map(c => c[0]);
    charts.company.data.datasets[0].data = topCompanies.map(c => c[1]);
    charts.company.update();
}

// 최근 체크인 목록 업데이트
function updateRecentCheckins(attendees) {
    const recentCheckins = attendees
        .filter(a => a['체크인시간'])
        .sort((a, b) => new Date(b['체크인시간']) - new Date(a['체크인시간']))
        .slice(0, 10);
    
    const listElement = document.getElementById('recentCheckinsList');
    
    if (recentCheckins.length === 0) {
        listElement.innerHTML = '<div class="empty-state">아직 체크인한 참가자가 없습니다</div>';
        return;
    }
    
    listElement.innerHTML = recentCheckins.map(attendee => {
        const initial = attendee['고객명'] ? attendee['고객명'].charAt(0) : '?';
        const checkinTime = new Date(attendee['체크인시간']);
        const timeString = checkinTime.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        return `
            <div class="checkin-item">
                <div class="checkin-avatar">${initial}</div>
                <div class="checkin-info">
                    <div class="checkin-name">${attendee['고객명']}</div>
                    <div class="checkin-company">${attendee['회사명'] || '소속 없음'}</div>
                </div>
                <div class="checkin-time">${timeString}</div>
            </div>
        `;
    }).join('');
}

// 통계 새로고침
async function refreshAnalytics() {
    await loadAnalyticsData();
}

// 페이지 언로드 시 interval 정리
window.addEventListener('beforeunload', () => {
    if (analyticsInterval) {
        clearInterval(analyticsInterval);
    }
});

// 전역 함수 노출
window.loadEventOptions = loadEventOptions;
window.handleEventChange = handleEventChange;
window.refreshAnalytics = refreshAnalytics;