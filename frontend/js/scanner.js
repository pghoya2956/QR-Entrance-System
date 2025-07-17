/**
 * QR 스캐너 전용 페이지 JavaScript
 */

let html5QrCode = null;
let isScanning = false;
const recentScans = new Map();
const SCAN_COOLDOWN = 3000;

// 스캐너 프레임 색상 변경
function setFrameState(state) {
    const frame = document.getElementById('scannerFrame');
    if (!frame) {
        console.error('scannerFrame 요소를 찾을 수 없습니다');
        return;
    }
    // 스캐너가 시작되면 프레임 표시
    frame.style.display = 'block';
    frame.className = 'scanner-frame';
    if (state) {
        frame.classList.add(state);
    }
}

// 결과 표시
function showResult(message, type) {
    const resultDiv = document.getElementById('resultDisplay');
    resultDiv.style.display = 'block';
    resultDiv.className = `result-display result-${type}`;
    resultDiv.innerHTML = message;
    
    setFrameState(type === 'warning' ? 'detecting' : type);
    
    setTimeout(() => {
        setFrameState('');
    }, 1000);
    
    setTimeout(() => {
        resultDiv.style.display = 'none';
    }, 3000);
}

// 체크인 처리
async function processCheckin(qrData) {
    try {
        setFrameState('detecting');
        
        const result = await api.verifyCheckin(qrData);
        
        if (result.success) {
            showResult(`✓ ${result.attendeeInfo.name}님 체크인 완료!<br><small>${result.attendeeInfo.company}</small>`, 'success');
            audioFeedback.success();
        } else if (result.status === 409) {
            showResult(`⚠ ${result.attendeeInfo.name}님은 이미 체크인됨<br><small>${result.attendeeInfo.company}</small>`, 'warning');
            audioFeedback.duplicate();
        } else {
            showResult(`✗ ${result.error}`, 'error');
            audioFeedback.error();
        }
    } catch (error) {
        console.error('체크인 오류:', error);
        showResult('✗ 네트워크 오류', 'error');
        audioFeedback.networkError();
    }
}

// QR 스캔 성공 핸들러
function onScanSuccess(decodedText, decodedResult) {
    const lastScan = recentScans.get(decodedText);
    const now = Date.now();
    
    if (lastScan && (now - lastScan) < SCAN_COOLDOWN) {
        console.log('중복 스캔 무시:', decodedText);
        return;
    }
    
    console.log('QR 감지:', decodedText);
    recentScans.set(decodedText, now);
    
    // 오래된 스캔 기록 정리
    for (const [key, time] of recentScans) {
        if (now - time > SCAN_COOLDOWN * 2) {
            recentScans.delete(key);
        }
    }
    
    processCheckin(decodedText);
}

// QR 스캔 실패 핸들러
function onScanFailure(error) {
    // 스캔 실패는 무시 (연속적으로 발생하므로)
}

// 스캐너 시작
async function startScanning() {
    try {
        // 백엔드 연결 확인
        if (!currentBackend) {
            document.getElementById('status').textContent = '백엔드가 선택되지 않았습니다';
            audioFeedback.error();
            return;
        }
        
        if (!html5QrCode) {
            // Html5Qrcode가 전역에 정의되어 있는지 확인
            if (typeof Html5Qrcode === 'undefined') {
                console.error('Html5Qrcode 라이브러리가 로드되지 않았습니다');
                throw new Error('QR 스캐너 라이브러리를 찾을 수 없습니다');
            }
            html5QrCode = new Html5Qrcode("reader");
        }
        
        const config = {
            fps: 10,
            qrbox: { width: 350, height: 350 },
            aspectRatio: 1.0,
            videoConstraints: {
                facingMode: "environment",
                advanced: [{
                    mirrored: true
                }]
            }
        };
        
        document.getElementById('status').textContent = '카메라 시작 중...';
        
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        );
        
        // 비디오 요소에 좌우반전 CSS 적용
        const video = document.querySelector('#reader video');
        if (video) {
            video.style.transform = 'scaleX(-1)';
        }
        
        isScanning = true;
        document.getElementById('status').textContent = 'QR 코드를 스캔하세요';
        document.getElementById('toggleCamera').textContent = '카메라 중지';
        console.log('스캐너 시작됨');
        
    } catch (err) {
        console.error('스캐너 시작 실패:', err);
        document.getElementById('status').textContent = '카메라를 시작할 수 없습니다';
        audioFeedback.error();
    }
}

// 스캐너 중지
async function stopScanning() {
    try {
        if (html5QrCode && isScanning) {
            await html5QrCode.stop();
            isScanning = false;
            document.getElementById('status').textContent = '카메라가 중지되었습니다';
            document.getElementById('toggleCamera').textContent = '카메라 시작';
            console.log('스캐너 중지됨');
        }
    } catch (err) {
        console.error('스캐너 중지 실패:', err);
    }
}

// 카메라 토글
function toggleCamera() {
    if (isScanning) {
        stopScanning();
    } else {
        startScanning();
    }
}


// 스캐너 초기화 함수
async function initializeScanner() {
    console.log('QR 스캐너 초기화 시작');
    
    // 초기 상태 설정
    const toggleBtn = document.getElementById('toggleCamera');
    const statusDiv = document.getElementById('status');
    
    if (!toggleBtn || !statusDiv) {
        console.error('필수 DOM 요소를 찾을 수 없습니다');
        return;
    }
    
    // 오디오 초기화를 위한 첫 클릭 이벤트
    document.addEventListener('click', () => {
        audioFeedback.init();
    }, { once: true });
    
    // UI 활성화
    toggleBtn.disabled = false;
    statusDiv.textContent = '카메라 준비 중...';
    
    // 카메라 토글 버튼 이벤트
    toggleBtn.addEventListener('click', toggleCamera);
    
    // 자동으로 스캐너 시작
    await startScanning();
}

// 전역에서 접근 가능하도록 설정
window.initializeScanner = initializeScanner;

// 페이지 종료 시 정리
window.addEventListener('beforeunload', () => {
    stopScanning();
});

// 페이지 숨김/표시 처리
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isScanning) {
        stopScanning();
    } else if (!document.hidden && !isScanning) {
        startScanning();
    }
});