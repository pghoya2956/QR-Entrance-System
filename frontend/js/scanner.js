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


// QR 스캔 성공 핸들러
function onScanSuccess(decodedText, decodedResult) {
    console.log('onScanSuccess 호출됨!', decodedText);
    console.log('전체화면 모드:', isFullscreen);
    
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
    // 디버깅을 위해 첫 몇 번의 에러만 로그
    if (!window.scanFailureCount) window.scanFailureCount = 0;
    if (window.scanFailureCount < 5) {
        console.log('스캔 실패:', error);
        window.scanFailureCount++;
    }
    // 스캔 실패는 무시 (연속적으로 발생하므로)
}

// 스캐너 시작
async function startScanning() {
    try {
        console.log('스캐너 시작 함수 호출됨');
        console.log('currentEventId:', currentEventId);
        console.log('Html5Qrcode 라이브러리 로드 여부:', typeof Html5Qrcode);
        
        // 이벤트 선택 확인
        if (!currentEventId) {
            document.getElementById('status').textContent = '이벤트가 선택되지 않았습니다';
            audioFeedback.error();
            return;
        }
        
        if (!html5QrCode) {
            // Html5Qrcode가 전역에 정의되어 있는지 확인
            if (typeof Html5Qrcode === 'undefined') {
                console.error('Html5Qrcode 라이브러리가 로드되지 않았습니다');
                throw new Error('QR 스캐너 라이브러리를 찾을 수 없습니다');
            }
            console.log('새 Html5Qrcode 인스턴스 생성');
            html5QrCode = new Html5Qrcode("reader");
        }
        
        // 전체화면 여부에 따라 다른 설정 사용
        const config = isFullscreen && fullscreenConfig ? fullscreenConfig : {
            fps: 10,
            qrbox: { width: 350, height: 350 },
            aspectRatio: 1.0,
            videoConstraints: {
                facingMode: "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };
        
        document.getElementById('status').textContent = '카메라 시작 중...';
        
        console.log('카메라 시작 중... config:', config);
        console.log('전체화면 모드:', isFullscreen);
        
        // 카메라 권한 확인
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            console.log('카메라 권한 획득 성공');
            // 스트림 정리
            stream.getTracks().forEach(track => track.stop());
        } catch (permErr) {
            console.error('카메라 권한 오류:', permErr);
            document.getElementById('status').textContent = '카메라 권한이 필요합니다';
            throw new Error('카메라 권한이 거부되었습니다');
        }
        
        console.log('Html5QrCode.start() 호출 전');
        console.log('reader 요소 존재:', !!document.getElementById('reader'));
        console.log('reader 요소 크기:', document.getElementById('reader').offsetWidth, 'x', document.getElementById('reader').offsetHeight);
        
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        ).catch(err => {
            console.error('카메라 시작 에러 상세:', err);
            throw err;
        });
        console.log('Html5QrCode.start() 호출 후');
        
        // Html5QrCode가 생성한 요소들 확인
        setTimeout(() => {
            const scanRegion = document.getElementById('reader__scan_region');
            const dashboard = document.getElementById('reader__dashboard');
            console.log('스캔 영역 존재:', !!scanRegion);
            console.log('대시보드 존재:', !!dashboard);
            if (scanRegion) {
                console.log('스캔 영역 크기:', scanRegion.offsetWidth, 'x', scanRegion.offsetHeight);
            }
        }, 100);
        
        // 비디오 요소에 좌우반전 CSS 적용
        const video = document.querySelector('#reader video');
        if (video) {
            console.log('비디오 요소 찾음:', video);
            console.log('비디오 크기:', video.offsetWidth, 'x', video.offsetHeight);
            console.log('비디오 부모 요소:', video.parentElement);
            video.style.transform = 'scaleX(-1)';
            
            // 전체화면 모드에서 비디오 가시성 확인
            if (isFullscreen) {
                console.log('전체화면 모드에서 비디오 스타일:', window.getComputedStyle(video));
                console.log('reader 요소 스타일:', window.getComputedStyle(document.getElementById('reader')));
            }
        } else {
            console.error('비디오 요소를 찾을 수 없음!');
        }
        
        // 비디오 리스너 부착 (전체화면 모드용)
        attachVideoListeners();
        
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
            console.log('스캐너 중지 시작');
            await html5QrCode.stop();
            isScanning = false;
            
            // 상태 업데이트 (전체화면 모드가 아닐 때만)
            if (!isFullscreen) {
                document.getElementById('status').textContent = '카메라가 중지되었습니다';
                document.getElementById('toggleCamera').textContent = '카메라 시작';
            }
            console.log('스캐너 중지 완료');
        }
    } catch (err) {
        console.error('스캐너 중지 실패:', err);
        // 오류가 발생해도 상태는 업데이트
        isScanning = false;
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
    const readerDiv = document.getElementById('reader');
    
    console.log('DOM 요소 확인:', {
        toggleBtn: !!toggleBtn,
        statusDiv: !!statusDiv,
        readerDiv: !!readerDiv
    });
    
    if (!toggleBtn || !statusDiv || !readerDiv) {
        console.error('필수 DOM 요소를 찾을 수 없습니다', {
            toggleBtn,
            statusDiv,
            readerDiv
        });
        return;
    }
    
    // reader div 크기 확인
    console.log('Reader div 크기:', {
        width: readerDiv.offsetWidth,
        height: readerDiv.offsetHeight
    });
    
    // 오디오 초기화를 위한 첫 클릭 이벤트
    document.addEventListener('click', () => {
        audioFeedback.init();
    }, { once: true });
    
    // UI 활성화
    toggleBtn.disabled = false;
    statusDiv.textContent = '카메라 준비 중...';
    
    // 카메라 토글 버튼 이벤트
    toggleBtn.addEventListener('click', toggleCamera);
    
    // 전체화면 버튼 이벤트
    const fullscreenBtn = document.getElementById('toggleFullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        
        // Fullscreen API 지원 확인
        if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) {
            fullscreenBtn.style.display = 'none';
        }
    }
    
    // 전체화면 변경 이벤트
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    // 자동으로 스캐너 시작
    await startScanning();
}

// 전역에서 접근 가능하도록 설정
window.initializeScanner = initializeScanner;

// ===== 전체화면 기능 =====
let isFullscreen = false;
let fullscreenConfig = null;

// 전체화면 진입
async function enterFullscreen() {
    // 이벤트 선택 확인
    if (!currentEventId) {
        showToast('먼저 이벤트를 선택해주세요', 'warning');
        return;
    }
    
    // 스캐너가 시작되지 않았으면 먼저 시작
    if (!isScanning) {
        console.log('전체화면 진입 전 스캐너 시작');
        await startScanning();
    }
    
    const elem = document.documentElement;
    
    try {
        if (elem.requestFullscreen) {
            await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { // Safari
            await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) { // Firefox
            await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) { // IE/Edge
            await elem.msRequestFullscreen();
        }
        
        // 모바일에서 가로 모드 고정
        if (screen.orientation && screen.orientation.lock) {
            try {
                await screen.orientation.lock('landscape');
            } catch (e) {
                console.log('화면 방향 고정 실패:', e);
            }
        }
    } catch (error) {
        console.error('전체화면 진입 실패:', error);
        showToast('전체화면 모드를 시작할 수 없습니다', 'error');
    }
}

// 전체화면 종료
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { // Safari
        document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) { // Firefox
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) { // IE/Edge
        document.msExitFullscreen();
    }
    
    // 화면 방향 잠금 해제
    if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }
}

// 전체화면 토글
function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        enterFullscreen();
    } else {
        exitFullscreen();
    }
}

// 비디오 실제 표시 크기 계산
function calculateVideoDisplaySize() {
    const video = document.querySelector('#reader video');
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    const containerRatio = containerWidth / containerHeight;
    
    let displayWidth, displayHeight;
    
    if (videoRatio > containerRatio) {
        // 비디오가 더 넓음 - 좌우 맞춤
        displayWidth = containerWidth;
        displayHeight = containerWidth / videoRatio;
    } else {
        // 비디오가 더 높음 - 상하 맞춤
        displayHeight = containerHeight;
        displayWidth = containerHeight * videoRatio;
    }
    
    return {
        width: displayWidth,
        height: displayHeight,
        left: (containerWidth - displayWidth) / 2,
        top: (containerHeight - displayHeight) / 2
    };
}

// 스캔 가이드 동적 조정 (cover 모드에서는 필요 없음)
function adjustScanGuide() {
    // cover 모드로 변경했으므로 CSS에서 설정한 80vmin을 그대로 사용
    console.log('adjustScanGuide 호출됨 - cover 모드이므로 CSS 설정 유지');
}

// 전체화면 변경 이벤트 처리
async function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement || !!document.webkitFullscreenElement;
    
    if (isFullscreen) {
        document.body.classList.add('fullscreen-mode');
        
        // 전체화면용 대형 QR 스캔 설정
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 전체화면에서는 화면 크기 기준으로 큰 스캔 영역 설정
        const scanSize = Math.min(viewportWidth, viewportHeight) * 0.8; // 화면의 80%
        
        console.log('전체화면 스캔 설정:', {
            viewportWidth,
            viewportHeight,
            scanSize
        });
        
        fullscreenConfig = {
            fps: 15, // 더 빠른 스캔
            qrbox: { 
                width: Math.floor(scanSize), 
                height: Math.floor(scanSize) 
            },
            aspectRatio: viewportWidth / viewportHeight,
            videoConstraints: {
                facingMode: "environment",
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 }
            }
        };
        
        // 스캐너 재시작으로 새 설정 적용
        if (isScanning) {
            console.log('전체화면: 스캐너 재시작 시작');
            await stopScanning();
            // 잠시 대기하여 리소스 정리 확실히 하기
            await new Promise(resolve => setTimeout(resolve, 200));
            await startScanning();
            console.log('전체화면: 스캐너 재시작 완료');
        } else {
            console.log('전체화면: 스캐너 신규 시작');
            await startScanning();
        }
        
        // 스캔 가이드 표시
        document.body.classList.add('scanning');
        
        console.log('전체화면 모드 진입 - 스캔 가이드 조정 예약');
        console.log('scanGuide 엘리먼트 존재:', !!document.getElementById('scanGuide'));
        console.log('fullscreen-mode 클래스 추가됨:', document.body.classList.contains('fullscreen-mode'));
        
        // 비디오가 로드된 후 스캔 가이드 조정
        setTimeout(() => {
            console.log('setTimeout에서 adjustScanGuide 호출');
            adjustScanGuide();
        }, 500);
    } else {
        document.body.classList.remove('fullscreen-mode');
        document.body.classList.remove('scanning');
        fullscreenConfig = null;
        
        // 일반 모드로 돌아가면 스캐너 재시작
        if (isScanning) {
            await stopScanning();
            await startScanning();
        }
    }
}

// 오버레이 결과 표시
function showOverlayResult(message, type) {
    if (!isFullscreen) {
        // 일반 모드에서는 기존 함수 사용
        showResult(message, type);
        return;
    }
    
    const overlayResult = document.getElementById('overlayResult');
    const fullscreenFlash = document.getElementById('fullscreenFlash');
    const scanGuide = document.getElementById('scanGuide');
    
    // 스캔 가이드 잠시 숨김
    if (scanGuide) scanGuide.style.opacity = '0';
    
    // 결과 메시지 표시
    overlayResult.innerHTML = message;
    overlayResult.className = `overlay-result show ${type}`;
    
    // 전체화면 플래시 효과
    fullscreenFlash.className = `fullscreen-flash ${type}`;
    
    // 성공/실패에 따른 진동 효과 (모바일)
    if (navigator.vibrate) {
        if (type === 'success') {
            navigator.vibrate(200); // 짧은 진동
        } else if (type === 'error') {
            navigator.vibrate([100, 50, 100]); // 두 번 진동
        }
    }
    
    // 애니메이션 후 숨기기
    setTimeout(() => {
        overlayResult.classList.remove('show');
        fullscreenFlash.className = 'fullscreen-flash';
        if (scanGuide) scanGuide.style.opacity = '1';
    }, 3000);
}


// 체크인 처리 (전체화면 및 일반 모드 지원)
async function processCheckin(qrData) {
    try {
        console.log('체크인 처리 시작:', qrData);
        setFrameState('detecting');
        
        const result = await api.verifyCheckin(qrData);
        console.log('체크인 API 응답:', result);
        
        if (result.success) {
            const message = `✓ ${result.attendeeInfo.name}님 체크인 완료!<br><small>${result.attendeeInfo.company}</small>`;
            
            if (isFullscreen) {
                showOverlayResult(message, 'success');
            } else {
                showResult(message, 'success');
            }
            
            audioFeedback.success();
            
            // scanner.html에서는 최근 체크인 목록을 표시하지 않으므로 업데이트 불필요
        } else if (result.error && result.error.includes('이미 체크인')) {
            // 이미 체크인된 경우
            const message = `⚠ ${result.attendeeInfo.name}님은 이미 체크인됨<br><small>${result.attendeeInfo.company}</small>`;
            
            if (isFullscreen) {
                showOverlayResult(message, 'warning');
            } else {
                showResult(message, 'warning');
            }
            
            audioFeedback.duplicate();
        } else {
            // 기타 오류
            const message = `✗ ${result.message || result.error || '체크인 실패'}`;
            
            if (isFullscreen) {
                showOverlayResult(message, 'error');
            } else {
                showResult(message, 'error');
            }
            
            audioFeedback.error();
        }
    } catch (error) {
        console.error('체크인 처리 오류:', error);
        // 네트워크 오류 또는 기타 처리 오류
        const message = error.message?.includes('network') || error.message?.includes('Network') 
            ? '✗ 네트워크 오류' 
            : '✗ 체크인 처리 중 오류가 발생했습니다';
        
        if (isFullscreen) {
            showOverlayResult(message, 'error');
        } else {
            showResult(message, 'error');
        }
        
        audioFeedback.networkError();
    }
}

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

// 화면 크기 변경 이벤트 처리 (디바운싱 적용)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (isFullscreen) {
            adjustScanGuide();
        }
    }, 100);
});

// 비디오 메타데이터 로드 시 스캔 가이드 조정
function attachVideoListeners() {
    const video = document.querySelector('#reader video');
    if (video) {
        video.addEventListener('loadedmetadata', () => {
            if (isFullscreen) {
                adjustScanGuide();
            }
        });
    }
}