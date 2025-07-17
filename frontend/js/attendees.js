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
            <td>
                <button class="btn btn-sm btn-generate-qr" 
                        onclick="generateQRCode('${attendee['등록번호']}', '${attendee['고객명']}')">
                    QR 생성
                </button>
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

// 전역 스코프에 노출
window.toggleAttendeeCheckin = toggleAttendeeCheckin;

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

// QR 코드 관련 변수
let currentQRData = null;

// QR 코드 생성
async function generateQRCode(registrationNumber, name) {
    try {
        // API 호출
        const response = await fetch(getApiUrl('/api/qr/generate'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                registrationId: registrationNumber,
                name: name
            })
        });

        if (!response.ok) {
            throw new Error('QR 코드 생성 실패');
        }

        const result = await response.json();
        currentQRData = result.qrCode;

        // 모달 제목 업데이트
        document.getElementById('qrModalTitle').textContent = `QR 코드 - ${name} (${registrationNumber})`;

        // QR 코드 표시
        const qrContainer = document.getElementById('qrCode');
        qrContainer.innerHTML = `<img src="${result.qrCode}" alt="QR Code" style="max-width: 300px;">`;

        // 모달 표시
        const modal = document.getElementById('qrModal');
        modal.style.display = 'block';

        // ESC 키로 닫기
        document.addEventListener('keydown', handleModalEsc);
        
        // 모달 외부 클릭으로 닫기
        modal.addEventListener('click', handleModalOutsideClick);
    } catch (error) {
        console.error('QR 코드 생성 실패:', error);
        showToast('QR 코드 생성에 실패했습니다.', 'error');
    }
}

// 모달 닫기
function closeQRModal() {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'none';
    
    // 이벤트 리스너 제거
    document.removeEventListener('keydown', handleModalEsc);
    modal.removeEventListener('click', handleModalOutsideClick);
}

// ESC 키 핸들러
function handleModalEsc(event) {
    if (event.key === 'Escape') {
        closeQRModal();
    }
}

// 모달 외부 클릭 핸들러
function handleModalOutsideClick(event) {
    const modal = document.getElementById('qrModal');
    if (event.target === modal) {
        closeQRModal();
    }
}

// QR 코드 다운로드
function downloadQR() {
    if (!currentQRData) return;

    // base64 데이터를 blob으로 변환
    const base64Data = currentQRData.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    
    // 다운로드 링크 생성
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    // 파일명 설정
    const modalTitle = document.getElementById('qrModalTitle').textContent;
    const fileName = modalTitle.replace('QR 코드 - ', 'QR_').replace(/[^a-zA-Z0-9가-힣_]/g, '_') + '.png';
    a.download = fileName;
    
    document.body.appendChild(a);
    a.click();
    
    // 정리
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// 전역 스코프에 함수들 노출
window.generateQRCode = generateQRCode;
window.closeQRModal = closeQRModal;
window.downloadQR = downloadQR;