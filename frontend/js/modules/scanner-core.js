/**
 * 스캐너 핵심 기능 모듈
 * 기존 scanner.js의 함수들을 모듈화하되 인터페이스는 유지
 */

class ScannerCore {
    constructor() {
        this.html5QrCode = null;
        this.isScanning = false;
        this.recentScans = new Map();
        this.SCAN_COOLDOWN = AppConfig.scanner.cooldown;
        this.isFullscreen = false;
        this.fullscreenConfig = null;
        
        // 카메라 관련
        this.cameras = [];
        this.currentCameraId = null;
        
        // 이벤트 핸들러 바인딩
        this.onScanSuccess = this.onScanSuccess.bind(this);
        this.onScanFailure = this.onScanFailure.bind(this);
    }
    
    // 초기화
    async initialize() {
        console.log('[ScannerCore] 초기화 시작');
        
        // 디버그 정보 출력
        this.logDebugInfo();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 초기 상태 메시지
        this.updateStatus('카메라 권한 확인 중...');
        
        try {
            // 카메라 권한 요청
            await this.requestCameraPermission();
            
            // 약간의 지연 후 스캐너 시작 (권한 부여 직후 바로 시작하면 문제가 될 수 있음)
            setTimeout(async () => {
                try {
                    await this.startScanner();
                } catch (err) {
                    console.error('[ScannerCore] 스캐너 시작 실패:', err);
                    this.updateStatus('스캐너 시작 실패: ' + err.message);
                }
            }, 500);
        } catch (err) {
            console.error('[ScannerCore] 초기화 실패:', err);
            this.updateStatus('카메라 권한 확인 실패: ' + err.message);
        }
    }
    
    // 디버그 정보 로깅
    logDebugInfo() {
        const info = {
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            userAgent: navigator.userAgent,
            isSecureContext: window.isSecureContext,
            hasMediaDevices: !!navigator.mediaDevices,
            hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        };
        
        console.log('[ScannerCore] 환경 정보:', info);
        
        // 모바일인지 확인
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            console.log('[ScannerCore] 모바일 환경 감지');
            
            // HTTPS 경고
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                this.updateStatus('⚠️ 모바일에서는 HTTPS 연결이 필요합니다');
            }
        }
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 전체화면 토글
        const toggleFullscreenBtn = document.getElementById('toggleFullscreen');
        if (toggleFullscreenBtn) {
            toggleFullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }
        
        // 카메라 토글
        const toggleCameraBtn = document.getElementById('toggleCamera');
        if (toggleCameraBtn) {
            toggleCameraBtn.addEventListener('click', () => this.toggleCamera());
        }
        
        // 카메라 선택
        const cameraSelect = document.getElementById('cameraSelect');
        if (cameraSelect) {
            cameraSelect.addEventListener('change', async (e) => {
                const selectedCameraId = e.target.value;
                if (selectedCameraId && selectedCameraId !== this.currentCameraId) {
                    console.log('[ScannerCore] 카메라 변경:', selectedCameraId);
                    await this.switchCamera(selectedCameraId);
                }
            });
        }
        
        // 전체화면 변경 감지
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());
        
        // ESC 키로 전체화면 종료
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isFullscreen) {
                this.exitFullscreen();
            }
        });
    }
    
    // 카메라 권한 요청
    async requestCameraPermission() {
        try {
            // HTTPS 체크
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                console.warn('[ScannerCore] HTTPS가 아닙니다. 모바일에서는 HTTPS가 필요합니다.');
                this.updateStatus('보안 연결(HTTPS)이 필요합니다');
            }
            
            // 미디어 디바이스 API 지원 확인
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('이 브라우저는 카메라를 지원하지 않습니다');
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "environment" 
                } 
            });
            stream.getTracks().forEach(track => track.stop());
            console.log('[ScannerCore] 카메라 권한 획득 성공');
        } catch (err) {
            console.error('[ScannerCore] 카메라 권한 오류:', err);
            
            // 상세한 에러 메시지
            if (err.name === 'NotAllowedError') {
                this.updateStatus('카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
            } else if (err.name === 'NotFoundError') {
                this.updateStatus('카메라를 찾을 수 없습니다');
            } else if (err.name === 'NotReadableError') {
                this.updateStatus('카메라가 이미 사용 중입니다');
            } else if (err.name === 'SecurityError') {
                this.updateStatus('보안 오류: HTTPS 연결이 필요합니다');
            } else {
                this.updateStatus(`카메라 오류: ${err.message}`);
            }
            
            throw err;
        }
    }
    
    // 스캐너 시작
    async startScanner() {
        if (this.isScanning) {
            console.log('[ScannerCore] 이미 스캔 중입니다');
            return;
        }
        
        try {
            this.updateStatus('카메라 준비 중...');
            
            if (!Html5Qrcode) {
                throw new Error('QR 스캐너 라이브러리를 찾을 수 없습니다');
            }
            
            // 새 인스턴스 생성
            this.html5QrCode = new Html5Qrcode("reader");
            
            // 카메라 목록 가져오기
            this.cameras = await Html5Qrcode.getCameras();
            console.log('[ScannerCore] 사용 가능한 카메라:', this.cameras);
            
            if (this.cameras && this.cameras.length > 0) {
                // 카메라 목록 표시 (디버그용)
                this.cameras.forEach((camera, index) => {
                    console.log(`[카메라 ${index}] ${camera.label} (ID: ${camera.id})`);
                });
                
                // Chrome에서 iPhone 카메라가 안 보이는 경우 안내
                const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
                if (isChrome && this.cameras.length === 1 && !this.cameras.some(cam => 
                    cam.label.toLowerCase().includes('iphone') || 
                    cam.label.toLowerCase().includes('continuity')
                )) {
                    console.log('[ScannerCore] Chrome에서는 iPhone Continuity Camera가 지원되지 않습니다. Safari를 사용해주세요.');
                }
                
                // currentCameraId가 설정되지 않은 경우에만 자동 선택
                if (!this.currentCameraId) {
                    // iPhone/Continuity Camera 찾기
                    const iphoneCamera = this.cameras.find(camera => 
                        camera.label.toLowerCase().includes('iphone') || 
                        camera.label.toLowerCase().includes('continuity')
                    );
                    
                    if (iphoneCamera) {
                        console.log('[ScannerCore] iPhone 카메라 발견:', iphoneCamera.label);
                        this.currentCameraId = iphoneCamera.id;
                    } else {
                        // 후면 카메라 우선
                        const backCamera = this.cameras.find(camera => 
                            camera.label.toLowerCase().includes('back') || 
                            camera.label.toLowerCase().includes('rear')
                        );
                        this.currentCameraId = backCamera ? backCamera.id : this.cameras[0].id;
                    }
                }
                
                // 카메라 선택 드롭다운 업데이트
                this.updateCameraSelect();
                
                // 설정 가져오기
                const config = this.getScannerConfig();
                
                // 스캐너 시작
                console.log('[ScannerCore] 스캐너 시작 - 카메라 ID:', this.currentCameraId);
                console.log('[ScannerCore] 스캐너 설정:', config);
                
                await this.html5QrCode.start(
                    this.currentCameraId,
                    config,
                    this.onScanSuccess,
                    this.onScanFailure
                );
                
                this.isScanning = true;
                this.updateStatus('QR 코드를 스캔해주세요');
                this.updateCameraButton(true);
                
                // 카메라 거리 가이드 표시
                if (ConfigHelper.shouldShowCameraGuide()) {
                    this.showCameraDistanceGuide();
                }
                
                // 전체화면 모드라면 비디오 스타일 강제 적용
                if (this.isFullscreen) {
                    setTimeout(() => {
                        this.forceFullscreenVideo();
                    }, 500);
                }
                
                console.log('[ScannerCore] 스캐너 시작 완료');
            } else {
                throw new Error('사용 가능한 카메라가 없습니다');
            }
        } catch (err) {
            console.error('[ScannerCore] 스캐너 시작 오류:', err);
            
            // Html5Qrcode 특정 에러 처리
            if (err.toString().includes('NotAllowedError')) {
                this.updateStatus('카메라 권한을 허용해주세요');
                // 권한 요청 버튼 표시
                this.showPermissionButton();
            } else if (err.toString().includes('NotFoundError')) {
                this.updateStatus('카메라를 찾을 수 없습니다');
            } else if (err.toString().includes('NotReadableError')) {
                this.updateStatus('카메라가 다른 앱에서 사용 중입니다');
            } else if (err.toString().includes('OverconstrainedError')) {
                this.updateStatus('카메라 설정 오류. 다시 시도해주세요.');
            } else {
                this.updateStatus(`오류: ${err.message || err}`);
            }
            
            this.isScanning = false;
            this.updateCameraButton(false);
        }
    }
    
    // 스캐너 중지
    async stopScanner() {
        if (!this.isScanning || !this.html5QrCode) {
            console.log('[ScannerCore] 스캐너가 실행 중이 아닙니다');
            return;
        }
        
        try {
            await this.html5QrCode.stop();
            this.html5QrCode = null;
            this.isScanning = false;
            this.updateStatus('스캐너가 중지되었습니다');
            this.updateCameraButton(false);
            console.log('[ScannerCore] 스캐너 중지 완료');
        } catch (err) {
            console.error('[ScannerCore] 스캐너 중지 오류:', err);
        }
    }
    
    // 스캐너 설정 가져오기
    getScannerConfig() {
        const isIPhone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const config = ConfigHelper.getScannerConfig();
        
        if (this.isFullscreen) {
            // 전체화면 설정
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const scanSize = Math.min(
                Math.min(viewportWidth, viewportHeight) * 0.9,
                800
            );
            
            return {
                fps: isIPhone ? 5 : 15,
                qrbox: { width: scanSize, height: scanSize },
                aspectRatio: 1.0,
                videoConstraints: {
                    facingMode: "environment",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                },
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.DATA_MATRIX,
                    Html5QrcodeSupportedFormats.AZTEC,
                    Html5QrcodeSupportedFormats.PDF_417
                ],
                // 전체화면에서는 비디오 뷰를 조정하지 않음
                showTorchButtonIfSupported: false,
                useBarCodeDetectorIfSupported: true,
                disableFlip: true
            };
        }
        
        // 일반 모드 설정
        return {
            fps: config.fps,
            qrbox: config.qrbox,
            aspectRatio: config.aspectRatio,
            videoConstraints: {
                facingMode: "environment"
            },
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            }
        };
    }
    
    // QR 스캔 성공 핸들러
    async onScanSuccess(decodedText, decodedResult) {
        const now = Date.now();
        const lastScanTime = this.recentScans.get(decodedText) || 0;
        
        if (now - lastScanTime < this.SCAN_COOLDOWN) {
            console.log('[ScannerCore] 중복 스캔 방지:', decodedText);
            return;
        }
        
        this.recentScans.set(decodedText, now);
        
        try {
            await this.processCheckin(decodedText);
        } catch (error) {
            console.error('[ScannerCore] 체크인 처리 오류:', error);
        }
    }
    
    // QR 스캔 실패 핸들러
    onScanFailure(error) {
        // 스캔 실패는 무시 (너무 많은 로그 방지)
    }
    
    // 체크인 처리
    async processCheckin(qrData) {
        console.log('[ScannerCore] 체크인 처리 시작:', qrData);
        
        try {
            this.setFrameState('detecting');
            
            const result = await api.verifyCheckin(qrData);
            
            if (result.success) {
                const message = `✓ ${result.attendeeInfo.name}님 체크인 완료!<br><small>${result.attendeeInfo.company}</small>`;
                this.showResultMessage(message, 'success');
                audioFeedback.success();
            } else if (result.error && result.error.includes('이미 체크인')) {
                const message = `⚠ ${result.attendeeInfo.name}님은 이미 체크인됨<br><small>${result.attendeeInfo.company}</small>`;
                this.showResultMessage(message, 'warning');
                audioFeedback.duplicate();
            } else {
                const message = `✗ ${result.error}`;
                this.showResultMessage(message, 'error');
                audioFeedback.error();
            }
        } catch (error) {
            console.error('[ScannerCore] 체크인 오류:', error);
            const message = '✗ 네트워크 오류';
            this.showResultMessage(message, 'error');
            audioFeedback.networkError();
        }
    }
    
    // 결과 메시지 표시
    showResultMessage(message, type) {
        if (this.isFullscreen) {
            this.showOverlayResult(message, type);
        } else {
            this.showResult(message, type);
        }
    }
    
    // 일반 모드 결과 표시
    showResult(message, type) {
        const resultDiv = document.getElementById('resultDisplay');
        resultDiv.style.display = 'block';
        resultDiv.className = `result-display result-${type}`;
        resultDiv.innerHTML = message;
        
        this.setFrameState(type === 'warning' ? 'detecting' : type);
        
        setTimeout(() => {
            this.setFrameState('');
        }, 1000);
        
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 3000);
    }
    
    // 전체화면 모드 결과 표시
    showOverlayResult(message, type) {
        const overlay = document.getElementById('overlayResult');
        overlay.innerHTML = message;
        overlay.className = `overlay-result ${type}`;
        overlay.classList.add('show');
        
        // 플래시 효과
        const flash = document.getElementById('fullscreenFlash');
        flash.className = `fullscreen-flash ${type}`;
        
        setTimeout(() => {
            overlay.classList.remove('show');
            flash.className = 'fullscreen-flash';
        }, 3000);
    }
    
    // 프레임 상태 설정 (레거시 호환)
    setFrameState(state) {
        // 더 이상 사용하지 않음
    }
    
    // 상태 업데이트
    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }
    
    // 카메라 버튼 업데이트
    updateCameraButton(isScanning) {
        const btn = document.getElementById('toggleCamera');
        if (btn) {
            btn.innerHTML = isScanning ? 
                '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"></path></svg> 카메라 중지' :
                '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> 카메라 시작';
        }
    }
    
    // 카메라 토글
    async toggleCamera() {
        if (this.isScanning) {
            await this.stopScanner();
        } else {
            await this.startScanner();
        }
    }
    
    // 전체화면 토글
    toggleFullscreen() {
        if (!this.isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }
    
    // 전체화면 진입
    async enterFullscreen() {
        const elem = document.documentElement;
        
        try {
            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                await elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                await elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                await elem.msRequestFullscreen();
            }
        } catch (err) {
            console.error('[ScannerCore] 전체화면 진입 오류:', err);
        }
    }
    
    // 전체화면 종료
    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    
    // 전체화면 변경 핸들러
    async handleFullscreenChange() {
        const wasFullscreen = this.isFullscreen;
        this.isFullscreen = ConfigHelper.isFullscreen();
        
        if (this.isFullscreen) {
            document.body.classList.add('fullscreen-mode');
            document.body.classList.add('scanning');
            
            // 전체화면 진입 시 추가 처리
            setTimeout(() => {
                this.forceFullscreenVideo();
            }, 100);
        } else {
            document.body.classList.remove('fullscreen-mode');
            document.body.classList.remove('scanning');
        }
        
        // 전체화면 모드가 변경되면 스캐너 재시작
        if (wasFullscreen !== this.isFullscreen && this.isScanning) {
            console.log('[ScannerCore] 전체화면 모드 변경, 스캐너 재시작');
            await this.stopScanner();
            await this.startScanner();
        }
    }
    
    // 전체화면 비디오 강제 적용
    forceFullscreenVideo() {
        const video = document.querySelector('#reader video');
        if (video) {
            video.style.position = 'fixed';
            video.style.top = '0';
            video.style.left = '0';
            video.style.width = '100vw';
            video.style.height = '100vh';
            video.style.objectFit = 'cover';
            video.style.zIndex = '1';
        }
        
        // reader 내부의 모든 div도 전체 크기로
        const readerDivs = document.querySelectorAll('#reader > div');
        readerDivs.forEach(div => {
            div.style.width = '100%';
            div.style.height = '100%';
        });
    }
    
    // 카메라 거리 가이드 표시
    showCameraDistanceGuide() {
        const guide = document.getElementById('cameraDistanceGuide');
        if (guide) {
            guide.style.display = 'flex';
            
            // 5초 후 자동으로 숨기기
            setTimeout(() => {
                guide.style.display = 'none';
            }, 5000);
        }
    }
    
    // 권한 요청 버튼 표시
    showPermissionButton() {
        const reader = document.getElementById('reader');
        if (!reader) return;
        
        // 기존 버튼이 있으면 제거
        const existingBtn = document.getElementById('cameraPermissionBtn');
        if (existingBtn) existingBtn.remove();
        
        // 권한 요청 버튼 생성
        const btn = document.createElement('button');
        btn.id = 'cameraPermissionBtn';
        btn.className = 'btn btn-primary';
        btn.innerHTML = '📷 카메라 권한 허용하기';
        btn.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1000;
            padding: 16px 32px;
            font-size: 18px;
        `;
        
        btn.onclick = async () => {
            btn.disabled = true;
            btn.innerHTML = '권한 요청 중...';
            
            try {
                await this.requestCameraPermission();
                btn.remove();
                await this.startScanner();
            } catch (err) {
                btn.disabled = false;
                btn.innerHTML = '📷 다시 시도';
            }
        };
        
        reader.appendChild(btn);
    }
    
    // 카메라 선택 드롭다운 업데이트
    updateCameraSelect() {
        const cameraSelect = document.getElementById('cameraSelect');
        if (!cameraSelect || !this.cameras || this.cameras.length === 0) return;
        
        // 카메라가 2개 이상일 때만 표시
        if (this.cameras.length > 1) {
            cameraSelect.style.display = 'block';
            cameraSelect.innerHTML = '';
            
            this.cameras.forEach(camera => {
                const option = document.createElement('option');
                option.value = camera.id;
                option.textContent = this.formatCameraLabel(camera.label || `카메라 ${camera.id}`);
                
                if (camera.id === this.currentCameraId) {
                    option.selected = true;
                }
                
                cameraSelect.appendChild(option);
            });
        }
    }
    
    // 카메라 라벨 포맷팅
    formatCameraLabel(label) {
        // iPhone/Continuity Camera 강조
        if (label.toLowerCase().includes('iphone')) {
            return `📱 ${label}`;
        } else if (label.toLowerCase().includes('continuity')) {
            return `📱 ${label}`;
        } else if (label.toLowerCase().includes('back') || label.toLowerCase().includes('rear')) {
            return `📷 ${label} (후면)`;
        } else if (label.toLowerCase().includes('front')) {
            return `🤳 ${label} (전면)`;
        }
        return label;
    }
    
    // 카메라 전환
    async switchCamera(cameraId) {
        if (!cameraId || cameraId === this.currentCameraId) return;
        
        console.log('[ScannerCore] 카메라 전환 시작:', cameraId);
        
        // 선택된 카메라 정보 확인
        const selectedCamera = this.cameras.find(cam => cam.id === cameraId);
        console.log('[ScannerCore] 선택된 카메라:', selectedCamera);
        
        try {
            // 현재 스캐너 중지
            if (this.isScanning) {
                await this.stopScanner();
            }
            
            // 새 카메라로 설정
            this.currentCameraId = cameraId;
            console.log('[ScannerCore] 새 카메라 ID 설정:', this.currentCameraId);
            
            // 스캐너 재시작
            await this.startScanner();
            
            console.log('[ScannerCore] 카메라 전환 완료');
        } catch (err) {
            console.error('[ScannerCore] 카메라 전환 오류:', err);
            this.updateStatus('카메라 전환 실패');
        }
    }
}

// 전역 스캐너 인스턴스
window.scannerCore = new ScannerCore();

// 기존 함수들을 스캐너 코어로 연결 (호환성 유지)
window.initializeScanner = () => scannerCore.initialize();
window.startScanner = () => scannerCore.startScanner();
window.stopScanner = () => scannerCore.stopScanner();
window.toggleCamera = () => scannerCore.toggleCamera();
window.toggleFullscreen = () => scannerCore.toggleFullscreen();
window.onScanSuccess = (text, result) => scannerCore.onScanSuccess(text, result);
window.processCheckin = (qrData) => scannerCore.processCheckin(qrData);
window.showResult = (message, type) => scannerCore.showResult(message, type);
window.showOverlayResult = (message, type) => scannerCore.showOverlayResult(message, type);
window.setFrameState = (state) => scannerCore.setFrameState(state);

// getter 함수들
window.getIsScanning = () => scannerCore.isScanning;
window.getIsFullscreen = () => scannerCore.isFullscreen;
window.getHtml5QrCode = () => scannerCore.html5QrCode;