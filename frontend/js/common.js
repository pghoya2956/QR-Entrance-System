/**
 * 공통 유틸리티 및 API 함수
 */

// API 기본 URL
const API_BASE_URL = '';

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
            const response = await fetch(`${API_BASE_URL}/api/admin/attendees`);
            if (!response.ok) throw new Error('Failed to fetch attendees');
            return await response.json();
        } catch (error) {
            console.error('Error fetching attendees:', error);
            throw error;
        }
    },
    
    // 통계 가져오기
    async getStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/stats`);
            if (!response.ok) throw new Error('Failed to fetch stats');
            return await response.json();
        } catch (error) {
            console.error('Error fetching stats:', error);
            throw error;
        }
    },
    
    // 체크인 토글
    async toggleCheckin(registrationNumber) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/attendee/${registrationNumber}/toggle-checkin`, {
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
            const response = await fetch(`${API_BASE_URL}/api/checkin/verify`, {
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
            const response = await fetch(`${API_BASE_URL}/api/admin/export-csv`);
            if (!response.ok) throw new Error('Failed to download CSV');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'attendees.csv';
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
            
            const response = await fetch(`${API_BASE_URL}/api/admin/import-csv`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Failed to upload CSV');
            return await response.json();
        } catch (error) {
            console.error('Error uploading CSV:', error);
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