/**
 * QR 스캐너 페이지 - 간소화된 버전
 * scanner-core.js 모듈을 사용
 */

// 페이지 로드 시 스캐너 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Scanner] 페이지 로드 완료');
    
    // 스캐너 초기화는 index.html의 초기화 스크립트에서 처리
    // 여기서는 추가적인 페이지별 설정만 처리
    
    // 통계 정보 업데이트 주기 설정
    setInterval(() => {
        updateScannerStats();
    }, 30000); // 30초마다 업데이트
    
    // 체크인 완료 이벤트 리스너
    window.addEventListener('checkinCompleted', (event) => {
        console.log('[Scanner] 체크인 완료 이벤트 수신:', event.detail);
        if (event.detail) {
            updateRecentCheckins(event.detail);
        }
    });
});

// 스캔 통계 업데이트
function updateScannerStats() {
    const totalScans = document.getElementById('totalScans');
    const successScans = document.getElementById('successScans');
    const failedScans = document.getElementById('failedScans');
    
    // 통계 요소가 있는 경우에만 업데이트
    if (totalScans && successScans && failedScans) {
        const stats = JSON.parse(localStorage.getItem('scannerStats') || '{"total": 0, "success": 0, "failed": 0}');
        totalScans.textContent = stats.total || 0;
        successScans.textContent = stats.success || 0;
        failedScans.textContent = stats.failed || 0;
    }
}

// 최근 체크인 목록 업데이트
function updateRecentCheckins(attendeeInfo) {
    const listElement = document.getElementById('recentCheckinsList');
    if (!listElement) return;
    
    // 기존 목록 가져오기
    let recentCheckins = JSON.parse(localStorage.getItem('recentCheckins') || '[]');
    
    // 새 체크인 추가
    recentCheckins.unshift({
        name: attendeeInfo.name,
        company: attendeeInfo.company,
        time: new Date().toLocaleTimeString('ko-KR')
    });
    
    // 최대 10개까지만 유지
    recentCheckins = recentCheckins.slice(0, 10);
    
    // 저장
    localStorage.setItem('recentCheckins', JSON.stringify(recentCheckins));
    
    // UI 업데이트
    loadRecentCheckins();
}

// 최근 체크인 목록 로드
function loadRecentCheckins() {
    const recentCheckins = JSON.parse(localStorage.getItem('recentCheckins') || '[]');
    const listElement = document.getElementById('recentCheckinsList');
    
    if (!listElement) return;
    
    if (recentCheckins.length === 0) {
        listElement.innerHTML = '<div class="empty-state"><p>아직 체크인 기록이 없습니다</p></div>';
        return;
    }
    
    listElement.innerHTML = recentCheckins.slice(0, 10).map(checkin => `
        <div class="checkin-item">
            <div class="checkin-avatar">${checkin.name.charAt(0)}</div>
            <div class="checkin-info">
                <div class="checkin-name">${checkin.name}</div>
                <div class="checkin-time">${checkin.time}</div>
            </div>
        </div>
    `).join('');
}

// 디버깅용 함수들
window.testQRScan = function(qrData = 'REG001') {
    console.log('[테스트] QR 스캔 시뮬레이션:', qrData);
    if (window.scannerCore) {
        window.scannerCore.onScanSuccess(qrData, {});
    } else {
        console.error('scannerCore를 찾을 수 없습니다');
    }
};

window.debugScanner = function() {
    console.log('[스캐너 디버그 정보]', {
        currentEventId: window.currentEventId,
        scannerCore: !!window.scannerCore,
        isScanning: window.scannerCore ? window.scannerCore.isScanning : 'undefined',
        isFullscreen: window.scannerCore ? window.scannerCore.isFullscreen : 'undefined',
        html5QrCode: window.scannerCore ? !!window.scannerCore.html5QrCode : 'undefined'
    });
};