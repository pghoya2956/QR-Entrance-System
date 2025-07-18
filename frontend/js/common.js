/**
 * 공통 유틸리티 및 API 함수
 */

// 멀티 백엔드 지원을 위한 변수
let currentBackend = null;
let availableBackends = [];

// 백엔드 디스커버리 (포트 스캔)
async function discoverBackends() {
    const backends = [];
    const startPort = 3001;
    const endPort = 3010;
    
    console.log('🔍 백엔드 검색 중...');
    
    for (let port = startPort; port <= endPort; port++) {
        try {
            const response = await fetch(`/backend/${port}/api/info`, {
                method: 'GET',
                signal: AbortSignal.timeout(1000) // 1초 타임아웃
            });
            
            if (response.ok) {
                const info = await response.json();
                backends.push({
                    ...info,
                    baseUrl: `http://localhost:${port}`
                });
                console.log(`✅ 발견: ${info.eventName} (포트 ${port})`);
            }
        } catch (error) {
            // 연결 실패는 무시 (해당 포트에 백엔드 없음)
            console.log(`❌ 포트 ${port} 연결 실패`);
        }
    }
    
    availableBackends = backends;
    return backends;
}

// 현재 백엔드 설정
function setCurrentBackend(backend) {
    currentBackend = backend;
    localStorage.setItem('selectedBackendPort', backend.port);
    // 테스트를 위해 window 객체에도 저장
    window.apiBaseUrl = backend.baseUrl;
    console.log(`🎯 백엔드 선택됨: ${backend.eventName}`);
}

// API URL 생성
function getApiUrl(path) {
    if (!currentBackend) {
        throw new Error('백엔드가 선택되지 않았습니다.');
    }
    return `${currentBackend.baseUrl}${path}`;
}

// 저장된 백엔드 복원
async function restoreSelectedBackend() {
    const savedPort = localStorage.getItem('selectedBackendPort');
    if (savedPort && availableBackends.length > 0) {
        const backend = availableBackends.find(b => b.port == savedPort);
        if (backend) {
            setCurrentBackend(backend);
            return true;
        }
    }
    // 첫 번째 백엔드를 기본값으로 설정
    if (availableBackends.length > 0) {
        setCurrentBackend(availableBackends[0]);
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
            const response = await fetch(getApiUrl('/api/admin/attendees'));
            if (!response.ok) throw new Error('Failed to fetch attendees');
            return await response.json();
        } catch (error) {
            console.error('Error fetching attendees:', error);
            if (error.message.includes('백엔드가 선택되지 않았습니다')) {
                showToast('이벤트를 먼저 선택해주세요.', 'error');
            } else {
                showToast('참가자 목록을 불러올 수 없습니다. 백엔드 서버 연결을 확인해주세요.', 'error');
            }
            throw error;
        }
    },
    
    // 통계 가져오기
    async getStats() {
        try {
            const response = await fetch(getApiUrl('/api/admin/stats'));
            if (!response.ok) throw new Error('Failed to fetch stats');
            return await response.json();
        } catch (error) {
            console.error('Error fetching stats:', error);
            if (error.message.includes('백엔드가 선택되지 않았습니다')) {
                showToast('이벤트를 먼저 선택해주세요.', 'error');
            } else {
                showToast('통계 정보를 불러올 수 없습니다. 백엔드 서버 연결을 확인해주세요.', 'error');
            }
            throw error;
        }
    },
    
    // 체크인 토글
    async toggleCheckin(registrationNumber) {
        try {
            const response = await fetch(getApiUrl(`/api/admin/attendee/${registrationNumber}/toggle-checkin`), {
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
            const response = await fetch(getApiUrl('/api/checkin/verify'), {
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
            const response = await fetch(getApiUrl('/api/admin/export-csv'));
            if (!response.ok) throw new Error('Failed to download CSV');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `attendees-${currentBackend.eventId}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading CSV:', error);
            throw error;
        }
    },
    
    // CSV 업로드
    async uploadCSV(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(getApiUrl('/api/admin/import-csv'), {
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
            const response = await fetch(getApiUrl(`/api/admin/attendees/${registrationNumber}`), {
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
            const response = await fetch(getApiUrl(`/api/admin/attendees/${registrationNumber}`), {
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
            const response = await fetch(getApiUrl('/api/admin/attendees'), {
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
            const response = await fetch(getApiUrl('/api/admin/attendees/bulk'), {
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
            <button id="refreshBackends" class="btn btn-secondary btn-sm">새로고침</button>
        </div>
    `;
    
    return selector;
}

// 이벤트 선택기 업데이트
function updateEventSelector(backends) {
    const select = document.getElementById('eventSelect');
    if (!select) return;
    
    // 옵션 초기화
    select.innerHTML = '<option value="">이벤트를 선택하세요</option>';
    
    // 백엔드 옵션 추가
    backends.forEach(backend => {
        const option = document.createElement('option');
        option.value = backend.port;
        option.textContent = `${backend.eventName} (포트 ${backend.port})`;
        select.appendChild(option);
    });
    
    // 현재 선택된 백엔드 표시
    if (currentBackend) {
        select.value = currentBackend.port;
    }
    
    // 이벤트 리스너
    select.addEventListener('change', (e) => {
        const selectedPort = e.target.value;
        if (selectedPort) {
            const backend = availableBackends.find(b => b.port == selectedPort);
            if (backend) {
                setCurrentBackend(backend);
                
                // 페이지별로 다른 동작
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                
                if (currentPage === 'attendees.html') {
                    // 참석자 페이지에서는 데이터만 새로고침
                    if (typeof loadStats === 'function') loadStats();
                    if (typeof loadAttendees === 'function') loadAttendees();
                    showToast(`${backend.eventName}로 전환되었습니다.`, 'success');
                } else if (currentPage === 'index.html') {
                    // 메인 페이지에서는 통계만 새로고침
                    if (typeof loadStats === 'function') loadStats();
                    showToast(`${backend.eventName}로 전환되었습니다.`, 'success');
                } else {
                    // 다른 페이지에서는 페이지 새로고침
                    location.reload();
                }
            }
        }
    });
}

// 백엔드 초기화 (모든 페이지에서 호출)
async function initializeBackends() {
    try {
        // 백엔드 검색
        await discoverBackends();
        
        if (availableBackends.length === 0) {
            showToast('활성화된 백엔드가 없습니다.', 'error');
            return false;
        }
        
        // 이전 선택 복원 또는 첫 번째 백엔드 선택
        if (!await restoreSelectedBackend() && availableBackends.length > 0) {
            setCurrentBackend(availableBackends[0]);
        }
        
        // 이벤트 선택기 업데이트
        updateEventSelector(availableBackends);
        
        return true;
    } catch (error) {
        console.error('백엔드 초기화 오류:', error);
        showToast('백엔드 연결 실패', 'error');
        return false;
    }
}