// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    currentEventId = localStorage.getItem('selectedEventId') || null;
    await loadEvents();
});

// 이벤트 목록 로드
async function loadEvents() {
    const eventsGrid = document.getElementById('eventsGrid');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    
    // 로딩 상태 표시
    eventsGrid.style.display = 'none';
    emptyState.style.display = 'none';
    loadingState.style.display = 'flex';
    
    try {
        // /api/events 엔드포인트 호출 - 이벤트 목록은 event_id가 필요없으므로 직접 호출
        const response = await fetch('/api/events');
        
        if (!response.ok) {
            throw new Error('이벤트 목록 로드 실패');
        }
        
        const events = await response.json();
        availableEvents = events;
        
        if (events.length === 0) {
            // 빈 상태 표시
            loadingState.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        // 이벤트 카드 생성
        eventsGrid.innerHTML = '';
        
        for (const event of events) {
            const eventCard = await createEventCard(event);
            eventsGrid.innerHTML += eventCard;
        }
        
        // 그리드 표시
        loadingState.style.display = 'none';
        eventsGrid.style.display = 'grid';
        
    } catch (error) {
        console.error('이벤트 로드 실패:', error);
        showToast('이벤트 목록을 불러오는데 실패했습니다', 'error');
        loadingState.style.display = 'none';
        emptyState.style.display = 'block';
    }
}

// 이벤트 카드 생성
async function createEventCard(event) {
    let stats = { total: 0, checkedIn: 0 };
    
    try {
        // 이벤트별 통계 가져오기 - 특정 이벤트의 통계이므로 직접 URL 구성
        const response = await fetch(`/api/admin/stats?event_id=${event.eventId}`);
        if (response.ok) {
            stats = await response.json();
        }
    } catch (error) {
        console.error(`이벤트 ${event.eventId} 통계 로드 실패:`, error);
    }
    
    const checkinRate = stats.total > 0 
        ? Math.round((stats.checkedIn / stats.total) * 100) 
        : 0;
    
    const isActive = event.eventId === currentEventId;
    
    return `
        <div class="event-card ${isActive ? 'active' : ''}" onclick="selectEvent('${event.eventId}')">
            <div class="event-card-header">
                <div class="event-status ${isActive ? 'active' : ''}">${isActive ? '현재 선택됨' : '클릭하여 선택'}</div>
                <div class="event-card-title">${event.eventName}</div>
                <div class="event-card-subtitle">${event.eventId}</div>
            </div>
            <div class="event-card-body">
                <div class="event-info">
                    ${event.description ? `
                    <div class="event-info-item">
                        <svg class="event-info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span>${event.description}</span>
                    </div>
                    ` : ''}
                    <div class="event-info-item">
                        <svg class="event-info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span>생성일: ${new Date(event.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                </div>
                
                <div class="event-stats">
                    <div class="event-stat">
                        <div class="event-stat-value">${stats.total}</div>
                        <div class="event-stat-label">전체 참가자</div>
                    </div>
                    <div class="event-stat">
                        <div class="event-stat-value">${stats.checkedIn}</div>
                        <div class="event-stat-label">체크인</div>
                    </div>
                    <div class="event-stat">
                        <div class="event-stat-value">${checkinRate}%</div>
                        <div class="event-stat-label">참석률</div>
                    </div>
                </div>
            </div>
            <div class="event-card-footer">
                <a href="attendees.html" class="event-action" onclick="event.stopPropagation(); selectEvent('${event.eventId}')">
                    참가자 관리
                </a>
                <a href="scanner.html" class="event-action" onclick="event.stopPropagation(); selectEvent('${event.eventId}')">
                    QR 스캔
                </a>
            </div>
        </div>
    `;
}

// 이벤트 선택
function selectEvent(eventId) {
    localStorage.setItem('selectedEventId', eventId);
    currentEventId = eventId;
    showToast('이벤트가 선택되었습니다', 'success');
    
    // 카드 스타일 업데이트
    document.querySelectorAll('.event-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // 페이지를 새로고침하지 않고 그리드 다시 렌더링
    loadEvents();
}

// 전역 함수 노출
window.selectEvent = selectEvent;
window.loadEvents = loadEvents;