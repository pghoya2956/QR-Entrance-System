/**
 * 공통 유틸리티 및 API 함수
 */

// 버전 관리
const APP_VERSION = '3.1.1';

// 이벤트 관련 변수
let currentEventId = null;
let availableEvents = [];

// API 기본 URL
const API_BASE_URL = '/api';

// 이벤트 목록 가져오기
async function fetchEvents() {
    try {
        const response = await fetch(`${API_BASE_URL}/events`);
        if (!response.ok) throw new Error('Failed to fetch events');
        
        availableEvents = await response.json();
        console.log('✅ 이벤트 목록:', availableEvents);
        return availableEvents;
    } catch (error) {
        console.error('❌ 이벤트 목록 조회 실패:', error);
        showToast('이벤트 목록을 불러올 수 없습니다.', 'error');
        return [];
    }
}

// 현재 이벤트 설정
function setCurrentEvent(eventId) {
    currentEventId = eventId;
    localStorage.setItem('selectedEventId', eventId);
    console.log(`🎯 이벤트 선택됨: ${eventId}`);
}

// API URL 생성 (event_id 파라미터 포함)
function getApiUrl(path) {
    if (!currentEventId) {
        throw new Error('이벤트가 선택되지 않았습니다.');
    }
    // 쿼리 파라미터 추가
    const separator = path.includes('?') ? '&' : '?';
    return `${API_BASE_URL}${path}${separator}event_id=${currentEventId}`;
}

// 저장된 이벤트 복원
async function restoreSelectedEvent() {
    const savedEventId = localStorage.getItem('selectedEventId');
    if (savedEventId && availableEvents.length > 0) {
        const event = availableEvents.find(e => e.eventId === savedEventId);
        if (event) {
            setCurrentEvent(savedEventId);
            return true;
        }
    }
    // 첫 번째 이벤트를 기본값으로 설정
    if (availableEvents.length > 0) {
        setCurrentEvent(availableEvents[0].eventId);
        return true;
    }
    return false;
}

// 네비게이션 생성 함수
function createNavigation(currentPage) {
    const nav = document.createElement('nav');
    nav.className = 'main-navigation';
    
    const navItems = [
        { href: 'index.html', text: '홈', id: 'home' },
        { href: 'scanner.html', text: 'QR 스캐너', id: 'scanner' },
        { href: 'attendees.html', text: '참가자 관리', id: 'attendees' }
    ];
    
    const navList = document.createElement('ul');
    navList.className = 'nav-list';
    
    navItems.forEach(item => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = item.href;
        a.textContent = item.text;
        a.className = currentPage === item.id ? 'active' : '';
        li.appendChild(a);
        navList.appendChild(li);
    });
    
    nav.appendChild(navList);
    return nav;
}

// API 호출 함수들
const api = {
    // 참가자 목록 가져오기
    async getAttendees() {
        try {
            const response = await fetch(getApiUrl('/admin/attendees'));
            if (!response.ok) throw new Error('Failed to fetch attendees');
            return await response.json();
        } catch (error) {
            console.error('Error fetching attendees:', error);
            if (error.message.includes('이벤트가 선택되지 않았습니다')) {
                showToast('이벤트를 먼저 선택해주세요.', 'error');
            } else {
                showToast('참가자 목록을 불러올 수 없습니다.', 'error');
            }
            throw error;
        }
    },
    
    // 통계 가져오기
    async getStats() {
        try {
            const response = await fetch(getApiUrl('/admin/stats'));
            if (!response.ok) throw new Error('Failed to fetch stats');
            return await response.json();
        } catch (error) {
            console.error('Error fetching stats:', error);
            if (error.message.includes('이벤트가 선택되지 않았습니다')) {
                showToast('이벤트를 먼저 선택해주세요.', 'error');
            } else {
                showToast('통계 정보를 불러올 수 없습니다.', 'error');
            }
            throw error;
        }
    },
    
    // 체크인 토글
    async toggleCheckin(registrationNumber) {
        try {
            const response = await fetch(getApiUrl(`/admin/attendee/${registrationNumber}/toggle-checkin`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) throw new Error('Failed to toggle checkin');
            return await response.json();
        } catch (error) {
            console.error('Error toggling checkin:', error);
            throw error;
        }
    },
    
    // QR 체크인 검증
    async verifyCheckin(qrData) {
        try {
            const response = await fetch(getApiUrl('/checkin/verify'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ qrData })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                return {
                    success: false,
                    status: response.status,
                    ...result
                };
            }
            
            return {
                success: true,
                ...result
            };
        } catch (error) {
            console.error('Error verifying checkin:', error);
            throw error;
        }
    },
    
    // CSV 다운로드
    async downloadCSV() {
        try {
            const response = await fetch(getApiUrl('/admin/export-csv'));
            if (!response.ok) throw new Error('Failed to download CSV');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `attendees-${currentEventId}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading CSV:', error);
            throw error;
        }
    },
    
    // 이벤트 정보 가져오기
    async getEventInfo() {
        try {
            const response = await fetch(getApiUrl('/info'));
            if (!response.ok) throw new Error('Failed to fetch event info');
            return await response.json();
        } catch (error) {
            console.error('Error fetching event info:', error);
            throw error;
        }
    },
    
    // CSV 업로드
    async uploadCSV(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(getApiUrl('/admin/import-csv'), {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Failed to upload CSV');
            return await response.json();
        } catch (error) {
            console.error('Error uploading CSV:', error);
            throw error;
        }
    },
    
    // 참가자 수정
    async updateAttendee(registrationNumber, updates) {
        try {
            const response = await fetch(getApiUrl(`/admin/attendees/${registrationNumber}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update attendee');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error updating attendee:', error);
            throw error;
        }
    },
    
    // 참가자 삭제
    async deleteAttendee(registrationNumber) {
        try {
            const response = await fetch(getApiUrl(`/admin/attendees/${registrationNumber}`), {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete attendee');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error deleting attendee:', error);
            throw error;
        }
    },
    
    // 참가자 추가
    async addAttendee(attendeeData) {
        try {
            const response = await fetch(getApiUrl('/admin/attendees'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(attendeeData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add attendee');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error adding attendee:', error);
            throw error;
        }
    },
    
    // 일괄 참가자 추가
    async addAttendeesBulk(attendees) {
        try {
            const response = await fetch(getApiUrl('/admin/attendees/bulk'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ attendees })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add attendees');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error adding attendees in bulk:', error);
            throw error;
        }
    },
    
    // CSV 내보내기
    async exportCSV() {
        try {
            // CSV 다운로드는 직접 URL 호출
            window.location.href = getApiUrl('/admin/export-csv');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            throw error;
        }
    },
    
    // baseUrl 속성 추가 (기존 코드 호환성)
    get baseUrl() {
        return API_BASE_URL;
    }
};

// 통계 표시 업데이트 함수
function updateStatsDisplay(stats) {
    const elements = {
        totalAttendees: document.getElementById('totalAttendees'),
        checkedIn: document.getElementById('checkedIn'),
        notCheckedIn: document.getElementById('notCheckedIn'),
        checkedInPercentage: document.getElementById('checkedInPercentage')
    };
    
    if (elements.totalAttendees) elements.totalAttendees.textContent = stats.total;
    if (elements.checkedIn) elements.checkedIn.textContent = stats.checkedIn;
    if (elements.notCheckedIn) elements.notCheckedIn.textContent = stats.notCheckedIn;
    if (elements.checkedInPercentage) elements.checkedInPercentage.textContent = stats.checkedInPercentage + '%';
}

// 날짜 포맷 함수
function formatDate(dateString) {
    if (!dateString) return '-';
    return dateString;
}

// 검색 필터 함수
function filterAttendees(attendees, searchTerm) {
    if (!searchTerm) return attendees;
    
    const lowerSearch = searchTerm.toLowerCase();
    return attendees.filter(attendee => {
        return attendee['고객명'].toLowerCase().includes(lowerSearch) ||
               attendee['회사명'].toLowerCase().includes(lowerSearch) ||
               attendee['등록번호'].toLowerCase().includes(lowerSearch) ||
               attendee['연락처'].toLowerCase().includes(lowerSearch);
    });
}

// 체크인 상태별 필터 함수
function filterByCheckinStatus(attendees, status) {
    if (status === 'all') return attendees;
    if (status === 'checked') return attendees.filter(a => a['체크인'] === 'true');
    if (status === 'unchecked') return attendees.filter(a => a['체크인'] !== 'true');
    return attendees;
}

// 디바운스 함수 (실시간 검색용)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 이벤트 선택 초기화
async function initializeEventSelection() {
    try {
        // 이벤트 목록 가져오기
        await fetchEvents();
        
        // 저장된 이벤트 복원
        await restoreSelectedEvent();
        
        // 현재 이벤트가 설정되어 있는지 확인
        if (!currentEventId) {
            // 첫 번째 이벤트 선택
            if (availableEvents && availableEvents.length > 0) {
                setCurrentEvent(availableEvents[0].eventId);
            } else {
                throw new Error('사용 가능한 이벤트가 없습니다');
            }
        }
        
        console.log('✅ 이벤트 선택 초기화 완료:', currentEventId);
        return true;
    } catch (error) {
        console.error('❌ 이벤트 선택 초기화 실패:', error);
        throw error;
    }
}

// 스크립트/스타일 URL에 버전 추가
function addVersion(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${APP_VERSION}`;
}

// 토스트 메시지 표시
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 애니메이션을 위한 지연
    setTimeout(() => toast.classList.add('show'), 100);
    
    // 3초 후 제거
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

// 이벤트 선택 UI 생성
function createEventSelector() {
    const selector = document.createElement('div');
    selector.className = 'event-selector';
    selector.innerHTML = `
        <div class="event-selector-header">
            <span>현재 이벤트:</span>
            <select id="eventSelect" class="event-select">
                <option value="">이벤트를 선택하세요</option>
            </select>
            <button id="refreshEvents" class="btn btn-secondary btn-sm">새로고침</button>
        </div>
    `;
    
    return selector;
}

// 이벤트 선택기 업데이트
function updateEventSelector(events) {
    const select = document.getElementById('eventSelect');
    if (!select) return;
    
    // 옵션 초기화
    select.innerHTML = '<option value="">이벤트를 선택하세요</option>';
    
    // 이벤트 옵션 추가
    events.forEach(event => {
        const option = document.createElement('option');
        option.value = event.eventId;
        option.textContent = `${event.eventName} (${event.attendeeCount}명)`;
        select.appendChild(option);
    });
    
    // 현재 선택된 이벤트 표시
    if (currentEventId) {
        select.value = currentEventId;
    }
    
    // 이벤트 리스너
    select.addEventListener('change', (e) => {
        const selectedEventId = e.target.value;
        if (selectedEventId) {
            const event = availableEvents.find(e => e.eventId === selectedEventId);
            if (event) {
                setCurrentEvent(selectedEventId);
                
                // 페이지별로 다른 동작
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                
                if (currentPage === 'attendees.html') {
                    // 참석자 페이지에서는 데이터만 새로고침
                    if (typeof loadStats === 'function') loadStats();
                    if (typeof loadAttendees === 'function') loadAttendees();
                    showToast(`${event.eventName}로 전환되었습니다.`, 'success');
                } else if (currentPage === 'index.html') {
                    // 메인 페이지에서는 통계만 새로고침
                    if (typeof loadStats === 'function') loadStats();
                    showToast(`${event.eventName}로 전환되었습니다.`, 'success');
                } else {
                    // 다른 페이지에서는 페이지 새로고침
                    location.reload();
                }
            }
        }
    });
}

// 이벤트 초기화 (모든 페이지에서 호출)
async function initializeEvents() {
    try {
        // 이벤트 목록 가져오기
        await fetchEvents();
        
        if (availableEvents.length === 0) {
            showToast('등록된 이벤트가 없습니다.', 'error');
            return false;
        }
        
        // 이전 선택 복원 또는 첫 번째 이벤트 선택
        if (!await restoreSelectedEvent() && availableEvents.length > 0) {
            setCurrentEvent(availableEvents[0].eventId);
        }
        
        // 이벤트 선택기 업데이트
        updateEventSelector(availableEvents);
        
        return true;
    } catch (error) {
        console.error('이벤트 초기화 오류:', error);
        showToast('이벤트 목록을 불러올 수 없습니다.', 'error');
        return false;
    }
}