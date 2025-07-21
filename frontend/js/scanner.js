/**
 * QR 스캐너 전용 페이지 JavaScript
 */

let html5QrCode = null;
let isScanning = false;
const recentScans = new Map();
const SCAN_COOLDOWN = 3000;

// 스캐너 프레임 색상 변경 - 더 이상 사용하지 않음
function setFrameState(state) {
    // 초록색 프레임 제거로 더 이상 필요 없음
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

// 체크인 처리 (전체화면 및 일반 모드 지원)
async function processCheckin(qrData) {
    console.log('[processCheckin 시작]', {
        qrData,
        currentEventId,
        isFullscreen
    });
    
    try {
        setFrameState('detecting');
        
        console.log('[API 호출 시작] verifyCheckin');
        const result = await api.verifyCheckin(qrData);
        console.log('[API 응답]', result);
        
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
            const message = `✗ ${result.error}`;
            
            if (isFullscreen) {
                showOverlayResult(message, 'error');
            } else {
                showResult(message, 'error');
            }
            
            audioFeedback.error();
        }
    } catch (error) {
        console.error('체크인 오류:', error);
        const message = '✗ 네트워크 오류';
        
        if (isFullscreen) {
            showOverlayResult(message, 'error');
        } else {
            showResult(message, 'error');
        }
        
        audioFeedback.networkError();
    }
}

// QR 스캔 성공 핸들러
function onScanSuccess(decodedText, decodedResult) {
    // iPhone 카메라에서는 디버깅 로그 활성화
    const isIPhone = localStorage.getItem('isIPhoneCamera') === 'true';
    if (isIPhone) {
        console.log('[QR 스캔 성공 - iPhone]', {
            text: decodedText,
            result: decodedResult,
            timestamp: new Date().toISOString()
        });
    }
    
    const lastScan = recentScans.get(decodedText);
    const now = Date.now();
    
    if (lastScan && (now - lastScan) < SCAN_COOLDOWN) {
        if (isIPhone) console.log('[중복 스캔 방지] 쿨다운 중:', decodedText);
        return;
    }
    
    recentScans.set(decodedText, now);
    
    // 오래된 스캔 기록 정리
    for (const [key, time] of recentScans) {
        if (now - time > SCAN_COOLDOWN * 2) {
            recentScans.delete(key);
        }
    }
    
    console.log('[체크인 처리 시작]', decodedText);
    processCheckin(decodedText);
}

// QR 스캔 실패 핸들러
function onScanFailure(error) {
    // 스캔 실패는 무시 (연속적으로 발생하므로)
    // 단, NotAllowedError나 NotFoundError는 로깅
    if (error && error.name && (error.name === 'NotAllowedError' || error.name === 'NotFoundError')) {
        console.error('[QR 스캔 오류]', error.name, error.message);
    }
}

// 비디오 요소가 준비될 때까지 대기
async function waitForVideo() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50; // 최대 5초 대기
        
        const checkVideo = () => {
            const video = document.querySelector('#reader video');
            if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                console.log('[비디오 준비 완료]', {
                    width: video.videoWidth,
                    height: video.videoHeight
                });
                resolve(video);
            } else if (attempts++ < maxAttempts) {
                setTimeout(checkVideo, 100);
            } else {
                console.warn('[비디오 준비 타임아웃]');
                resolve(null);
            }
        };
        
        checkVideo();
    });
}

// Html5Qrcode가 생성하는 테두리 제거
function removeScannerBorders() {
    // 즉시 제거
    const removeNow = () => {
        // silver 테두리가 있는 모든 요소 찾기
        const elementsWithBorder = document.querySelectorAll('#reader div[style*="border"]');
        elementsWithBorder.forEach(el => {
            if (el.style.border && (el.style.border.includes('silver') || el.style.border.includes('3px'))) {
                el.style.border = 'none';
                el.style.boxShadow = 'none';
                console.log('[테두리 제거됨]', el);
            }
        });
        
        // 모든 정사각형 스캔 영역의 테두리 제거
        const scanRegions = document.querySelectorAll('#reader div[style*="width"][style*="height"]');
        scanRegions.forEach(el => {
            // 정사각형이고 border가 있는 경우
            if (el.style.width === el.style.height && el.style.border) {
                el.style.border = 'none';
                console.log('[스캔 영역 테두리 제거됨]', el.style.width);
            }
        });
        
        // 구체적인 크기들도 추가로 확인 (200~800)
        const sizes = ['200px', '300px', '400px', '450px', '500px', '600px', '700px', '800px'];
        sizes.forEach(size => {
            const elements = document.querySelectorAll(`#reader div[style*="width: ${size}"][style*="height: ${size}"]`);
            elements.forEach(el => {
                if (el.style.border) {
                    el.style.border = 'none';
                    console.log(`[${size} 테두리 제거됨]`);
                }
            });
        });
    };
    
    // 즉시 실행
    removeNow();
    
    // 약간의 지연 후 다시 실행 (동적 생성 대응)
    setTimeout(removeNow, 100);
    setTimeout(removeNow, 500);
    
    // MutationObserver로 동적 변경 감지
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                removeNow();
            }
        });
    });
    
    // reader 요소 관찰 시작
    const reader = document.getElementById('reader');
    if (reader) {
        observer.observe(reader, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        });
        
        // 스캐너 중지 시 observer 정리
        window.currentBorderObserver = observer;
    }
}

// 스캐너 시작
async function startScanning() {
    try {
        
        // 이벤트 선택 확인
        if (!currentEventId) {
            document.getElementById('status').textContent = '이벤트가 선택되지 않았습니다';
            audioFeedback.error();
            return;
        }
        
        // 매번 새 인스턴스 생성하여 깨끗한 상태 유지
        if (html5QrCode) {
            try {
                await html5QrCode.clear();
            } catch (e) {
                console.log('[기존 인스턴스 정리 실패]', e);
            }
            html5QrCode = null;
        }
        
        // Html5Qrcode가 전역에 정의되어 있는지 확인
        if (typeof Html5Qrcode === 'undefined') {
            console.error('Html5Qrcode 라이브러리가 로드되지 않았습니다');
            throw new Error('QR 스캐너 라이브러리를 찾을 수 없습니다');
        }
        
        console.log('[Html5Qrcode 새 인스턴스 생성]');
        html5QrCode = new Html5Qrcode("reader");
        
        // 전체화면 여부에 따라 다른 설정 사용
        let config = isFullscreen && fullscreenConfig ? fullscreenConfig : {
            fps: 10,
            qrbox: { width: 700, height: 700 },  // 매우 큰 QR코드도 쉽게 인식
            aspectRatio: 1.0,  // 기본값 사용
            videoConstraints: {
                facingMode: "environment"
            },
            // QR 코드 인식률 개선
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            },
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE
            ]
        };
        
        document.getElementById('status').textContent = '카메라 시작 중...';
        
        
        // 카메라 권한 확인 및 사용 가능한 카메라 목록 가져오기
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            // 스트림 정리
            stream.getTracks().forEach(track => track.stop());
            
            // 사용 가능한 카메라 목록 확인
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            console.log('[사용 가능한 카메라]', videoDevices.map(d => ({
                deviceId: d.deviceId,
                label: d.label || 'Unknown Camera'
            })));
            
            // 저장된 카메라 선택 복원 또는 기본 카메라 사용
            const savedCameraId = localStorage.getItem('preferredCameraId');
            let selectedCamera = null;
            
            if (savedCameraId && videoDevices.some(d => d.deviceId === savedCameraId)) {
                selectedCamera = videoDevices.find(d => d.deviceId === savedCameraId);
                config.videoConstraints.deviceId = { exact: savedCameraId };
                console.log('[저장된 카메라 사용]', selectedCamera.label);
            } else if (videoDevices.length > 0) {
                // MacBook 웹캠보다 iPhone 카메라 우선 (label에 'iPhone' 포함)
                const iPhoneCamera = videoDevices.find(d => d.label.toLowerCase().includes('iphone'));
                if (iPhoneCamera) {
                    selectedCamera = iPhoneCamera;
                    config.videoConstraints.deviceId = { exact: iPhoneCamera.deviceId };
                    console.log('[iPhone 카메라 선택]', iPhoneCamera.label);
                }
            }
            
            // iPhone 카메라인 경우 특별 설정 적용
            if (selectedCamera && selectedCamera.label.toLowerCase().includes('iphone')) {
                console.log('[iPhone 카메라 최적화 적용]');
                localStorage.setItem('isIPhoneCamera', 'true');
                
                config.fps = 5;  // 낮은 FPS로 안정성 향상
                config.qrbox = { width: 600, height: 600 };  // iPhone도 매우 크게
                
                // iPhone 카메라용 추가 제약사항
                config.videoConstraints = {
                    ...config.videoConstraints,
                    width: { ideal: 1280 },  // 낮은 해상도로 성능 향상
                    height: { ideal: 720 }
                };
                
                // iPhone용 추가 실험적 기능
                config.experimentalFeatures = {
                    ...config.experimentalFeatures,
                    useBarCodeDetectorIfSupported: false  // iPhone에서는 기본 디코더 사용
                };
                
                // 더 관대한 QR 인식 설정
                config.qrbox = function(viewfinderWidth, viewfinderHeight) {
                    const minEdgePercentage = 0.5; // 50% of the smallest edge
                    const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                    const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
                    return {
                        width: qrboxSize,
                        height: qrboxSize
                    };
                };
            } else {
                localStorage.setItem('isIPhoneCamera', 'false');
            }
        } catch (permErr) {
            console.error('카메라 권한 오류:', permErr);
            document.getElementById('status').textContent = '카메라 권한이 필요합니다';
            throw new Error('카메라 권한이 거부되었습니다');
        }
        
        
        console.log('[스캐너 시작] 설정:', config);
        
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        ).catch(err => {
            console.error('[카메라 시작 에러 상세]', err);
            throw err;
        });
        
        console.log('[스캐너 시작 완료]');
        
        // Html5QrCode가 생성한 요소들 확인
        setTimeout(() => {
            const scanRegion = document.getElementById('reader__scan_region');
            const dashboard = document.getElementById('reader__dashboard');
            const video = document.querySelector('#reader video');
            console.log('[Html5QrCode 요소 확인]', {
                scanRegion: !!scanRegion,
                dashboard: !!dashboard,
                video: !!video,
                videoSize: video ? {width: video.videoWidth, height: video.videoHeight} : null
            });
        }, 100);
        
        // 비디오 요소가 준비될 때까지 대기
        await waitForVideo();
        
        // Html5Qrcode가 생성하는 silver 테두리 제거
        removeScannerBorders();
        
        // 비디오 요소에 좌우반전 CSS 적용
        const video = document.querySelector('#reader video');
        if (video) {
            video.style.transform = 'scaleX(-1)';
            
            // 전체화면 모드에서 비디오 가시성 확인
            if (isFullscreen) {
                console.log('[전체화면 비디오 상태]', {
                    visible: video.style.display !== 'none',
                    opacity: video.style.opacity,
                    zIndex: getComputedStyle(video).zIndex
                });
            }
            
            // 일반 모드에서 프레임 위치 조정
            if (!isFullscreen) {
                adjustFramePosition();
            }
        } else {
            console.error('비디오 요소를 찾을 수 없음!');
        }
        
        // 비디오 리스너 부착 (전체화면 모드용)
        attachVideoListeners();
        
        isScanning = true;
        document.getElementById('status').textContent = 'QR 코드를 스캔하세요';
        document.getElementById('toggleCamera').textContent = '카메라 중지';
        
    } catch (err) {
        console.error('[스캐너 시작 실패]', err);
        
        // 특정 오류에 대한 재시도
        if (err.name === 'NotAllowedError') {
            document.getElementById('status').textContent = '카메라 권한이 필요합니다';
        } else if (err.name === 'NotFoundError') {
            document.getElementById('status').textContent = '카메라를 찾을 수 없습니다';
        } else if (err.message && err.message.includes('Camera already started')) {
            console.log('[카메라 이미 시작됨 - 재시도]');
            // 이미 시작된 경우 정리 후 재시도
            try {
                await stopScanning();
                await new Promise(resolve => setTimeout(resolve, 500));
                // 재귀 호출로 다시 시도
                return await startScanning();
            } catch (retryErr) {
                console.error('[재시도 실패]', retryErr);
            }
        } else {
            document.getElementById('status').textContent = '카메라를 시작할 수 없습니다';
        }
        
        audioFeedback.error();
        throw err;
    }
}

// 스캐너 중지
async function stopScanning() {
    try {
        if (html5QrCode && isScanning) {
            console.log('[스캐너 중지 시작]');
            
            // 비디오 스트림 명시적 정리
            const video = document.querySelector('#reader video');
            if (video && video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => {
                    track.stop();
                    console.log('[트랙 중지]', track.kind);
                });
            }
            
            await html5QrCode.stop();
            
            // Html5Qrcode 인스턴스 초기화
            await html5QrCode.clear();
            html5QrCode = null;
            
            // MutationObserver 정리
            if (window.currentBorderObserver) {
                window.currentBorderObserver.disconnect();
                window.currentBorderObserver = null;
            }
            
            isScanning = false;
            console.log('[스캐너 중지 완료]');
            
            // 상태 업데이트 (전체화면 모드가 아닐 때만)
            if (!isFullscreen) {
                document.getElementById('status').textContent = '카메라가 중지되었습니다';
                document.getElementById('toggleCamera').textContent = '카메라 시작';
            }
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


// 현재 사용 중인 카메라 장치 정보 가져오기
async function getCurrentCameraDevice() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const savedCameraId = localStorage.getItem('preferredCameraId');
        
        if (savedCameraId) {
            return videoDevices.find(d => d.deviceId === savedCameraId);
        }
        
        // iPhone 카메라 우선 찾기
        return videoDevices.find(d => d.label.toLowerCase().includes('iphone')) || videoDevices[0];
    } catch (error) {
        console.error('카메라 장치 조회 실패:', error);
        return null;
    }
}

// Html5Qrcode 라이브러리 로드 대기
async function waitForHtml5Qrcode() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50; // 최대 5초 대기
        
        const checkLibrary = () => {
            if (typeof Html5Qrcode !== 'undefined' && typeof Html5QrcodeSupportedFormats !== 'undefined') {
                console.log('[Html5Qrcode 라이브러리 로드 완료]');
                resolve(true);
            } else if (attempts++ < maxAttempts) {
                setTimeout(checkLibrary, 100);
            } else {
                console.error('[Html5Qrcode 라이브러리 로드 실패]');
                resolve(false);
            }
        };
        
        checkLibrary();
    });
}

// 스캐너 초기화 함수
async function initializeScanner() {
    console.log('[스캐너 초기화 시작]');
    
    // Html5Qrcode 라이브러리 로드 대기
    const libraryLoaded = await waitForHtml5Qrcode();
    if (!libraryLoaded) {
        console.error('QR 스캐너 라이브러리를 로드할 수 없습니다');
        document.getElementById('status').textContent = 'QR 스캐너 라이브러리 로드 실패';
        return;
    }
    
    // 초기 상태 설정
    const toggleBtn = document.getElementById('toggleCamera');
    const statusDiv = document.getElementById('status');
    const readerDiv = document.getElementById('reader');
    
    if (!toggleBtn || !statusDiv || !readerDiv) {
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
}

// 전체화면 변경 이벤트 처리
async function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement || !!document.webkitFullscreenElement;
    
    if (isFullscreen) {
        document.body.classList.add('fullscreen-mode');
        
        // 전체화면용 대형 QR 스캔 설정
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // iPhone 카메라 감지
        const currentDevice = await getCurrentCameraDevice();
        const isIPhoneCamera = currentDevice && currentDevice.label.toLowerCase().includes('iphone');
        
        console.log('[전체화면 모드 - 카메라 정보]', {
            device: currentDevice ? currentDevice.label : 'Unknown',
            isIPhone: isIPhoneCamera
        });
        
        // 전체화면에서 화면의 90% 크기 사용 (최대 800px)
        const scanSize = Math.min(
            Math.min(viewportWidth, viewportHeight) * 0.9,
            800
        );
        
        
        fullscreenConfig = {
            fps: isIPhoneCamera ? 5 : 15, // iPhone은 매우 낮은 fps
            qrbox: { 
                width: scanSize, 
                height: scanSize 
            },
            aspectRatio: 1.0,  // 기본값으로 변경하여 확대 방지
            videoConstraints: {
                facingMode: "environment"
                // width, height 제거하여 카메라 기본 해상도 사용
            },
            // QR 코드 인식률 개선
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            },
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE
            ]
        };
        
        // 스캐너 재시작으로 새 설정 적용
        if (isScanning) {
            await stopScanning();
            // 잠시 대기하여 리소스 정리 확실히 하기
            await new Promise(resolve => setTimeout(resolve, 200));
            await startScanning();
        } else {
            await startScanning();
        }
        
        // 스캔 가이드 표시
        document.body.classList.add('scanning');
        
        
        // 비디오가 로드된 후 스캔 가이드 조정
        setTimeout(() => {
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

// 페이지 종료 시 정리
window.addEventListener('beforeunload', () => {
    stopScanning();
});

// 디버깅을 위한 전역 노출
window.onScanSuccess = onScanSuccess;
window.processCheckin = processCheckin;
window.getIsScanning = () => isScanning;
window.getIsFullscreen = () => isFullscreen;
window.getHtml5QrCode = () => html5QrCode;

// 카메라 선택 헬퍼 함수
window.listCameras = async function() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('사용 가능한 카메라:');
        videoDevices.forEach((device, index) => {
            console.log(`${index}: ${device.label || 'Unknown Camera'} (${device.deviceId})`);
        });
        return videoDevices;
    } catch (error) {
        console.error('카메라 목록 조회 실패:', error);
    }
};

window.selectCamera = async function(indexOrId) {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        let selectedDevice;
        if (typeof indexOrId === 'number') {
            selectedDevice = videoDevices[indexOrId];
        } else {
            selectedDevice = videoDevices.find(d => d.deviceId === indexOrId);
        }
        
        if (selectedDevice) {
            localStorage.setItem('preferredCameraId', selectedDevice.deviceId);
            console.log(`카메라 선택됨: ${selectedDevice.label} (${selectedDevice.deviceId})`);
            console.log('스캐너를 재시작하면 선택한 카메라가 사용됩니다.');
            
            // 현재 스캔 중이면 재시작
            if (isScanning) {
                await stopScanning();
                await startScanning();
            }
        } else {
            console.error('카메라를 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('카메라 선택 실패:', error);
    }
};

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
            } else {
                adjustFramePosition();
            }
        });
    }
}

// 일반 모드에서 프레임 위치 조정
function adjustFramePosition() {
    const reader = document.getElementById('reader');
    const video = document.querySelector('#reader video');
    const frameOverlay = document.querySelector('.scanner-frame-overlay');
    
    if (!reader || !video || !frameOverlay) return;
    
    // 비디오의 실제 표시 크기 계산
    const videoRect = video.getBoundingClientRect();
    const readerRect = reader.getBoundingClientRect();
    
    // 비디오가 reader 내에서 실제로 표시되는 영역 계산
    const videoDisplayHeight = videoRect.height;
    const readerHeight = readerRect.height;
    
    // 프레임을 비디오의 실제 중앙에 배치
    if (videoDisplayHeight > 0) {
        const offsetTop = (readerHeight - videoDisplayHeight) / 2;
        frameOverlay.style.top = `calc(50% + ${offsetTop}px)`;
    }
}