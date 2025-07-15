/**
 * 참가자 관리 페이지 JavaScript
 */

let allAttendees = [];
let currentFilter = 'all';
let currentSearch = '';

// 참가자 목록 로드
async function loadAttendees() {
    try {
        allAttendees = await api.getAttendees();
        renderAttendees();
    } catch (error) {
        console.error('참가자 목록 로딩 실패:', error);
        showToast('참가자 목록을 불러올 수 없습니다.', 'error');
    }
}

// 통계 로드
async function loadStats() {
    try {
        const stats = await api.getStats();
        updateStatsDisplay(stats);
    } catch (error) {
        console.error('통계 로딩 실패:', error);
    }
}

// 참가자 목록 렌더링
function renderAttendees() {
    const tbody = document.getElementById('attendeesTableBody');
    tbody.innerHTML = '';
    
    // 필터링 적용
    let filteredAttendees = filterByCheckinStatus(allAttendees, currentFilter);
    filteredAttendees = filterAttendees(filteredAttendees, currentSearch);
    
    // 테이블에 행 추가
    filteredAttendees.forEach(attendee => {
        const tr = document.createElement('tr');
        const isCheckedIn = attendee['체크인'] === 'true';
        
        tr.innerHTML = `
            <td>${attendee['등록번호']}</td>
            <td>${attendee['고객명']}</td>
            <td>${attendee['회사명']}</td>
            <td>${attendee['연락처']}</td>
            <td>${attendee['이메일']}</td>
            <td><span class="attendee-type">${attendee['초대/현장방문']}</span></td>
            <td>${formatDate(attendee['체크인시간'])}</td>
            <td>
                <div class="checkin-toggle ${isCheckedIn ? 'checked' : ''}" 
                     data-registration="${attendee['등록번호']}"
                     onclick="toggleAttendeeCheckin('${attendee['등록번호']}')">
                    ${isCheckedIn ? '✓' : '○'}
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// 체크인 토글
async function toggleAttendeeCheckin(registrationNumber) {
    try {
        const result = await api.toggleCheckin(registrationNumber);
        
        if (result.success) {
            // 로컬 데이터 업데이트
            const attendeeIndex = allAttendees.findIndex(a => a['등록번호'] === registrationNumber);
            if (attendeeIndex !== -1) {
                allAttendees[attendeeIndex] = result.attendee;
            }
            
            // UI 업데이트
            renderAttendees();
            await loadStats();
            
            showToast(result.message, 'success');
        }
    } catch (error) {
        console.error('체크인 토글 실패:', error);
        showToast('체크인 상태 변경에 실패했습니다.', 'error');
    }
}

// 검색 기능
const searchHandler = debounce(function(e) {
    currentSearch = e.target.value;
    renderAttendees();
}, 300);

// 필터 변경
function handleFilterChange(filter) {
    currentFilter = filter;
    
    // 버튼 활성화 상태 업데이트
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });
    
    renderAttendees();
}

// CSV 업로드 처리
async function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const result = await api.uploadCSV(file);
        
        if (result.success) {
            showToast(result.message, 'success');
            // 데이터 다시 로드
            await loadAttendees();
            await loadStats();
        }
    } catch (error) {
        console.error('CSV 업로드 실패:', error);
        showToast('CSV 업로드에 실패했습니다.', 'error');
    }
    
    // 파일 입력 초기화
    event.target.value = '';
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', () => {
    console.log('참가자 관리 페이지 시작');
    
    // 검색 이벤트 리스너
    document.getElementById('searchBox').addEventListener('input', searchHandler);
    
    // 필터 버튼 이벤트 리스너
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => handleFilterChange(btn.dataset.filter));
    });
    
    // CSV 업로드 이벤트 리스너
    document.getElementById('csvFile').addEventListener('change', handleCSVUpload);
    
    // 초기 데이터 로드
    loadStats();
    loadAttendees();
    
    // 5초마다 통계 업데이트
    setInterval(loadStats, 5000);
});