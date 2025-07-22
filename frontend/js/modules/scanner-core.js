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
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 카메라 권한 요청
        await this.requestCameraPermission();
        
        // 스캐너 시작
        await this.startScanner();
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
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            console.log('[ScannerCore] 카메라 권한 획득 성공');
        } catch (err) {
            console.error('[ScannerCore] 카메라 권한 오류:', err);
            this.updateStatus('카메라 권한이 필요합니다');
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
                // 후면 카메라 우선
                const backCamera = this.cameras.find(camera => 
                    camera.label.toLowerCase().includes('back') || 
                    camera.label.toLowerCase().includes('rear')
                );
                this.currentCameraId = backCamera ? backCamera.id : this.cameras[0].id;
                
                // 설정 가져오기
                const config = this.getScannerConfig();
                
                // 스캐너 시작
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
                
                console.log('[ScannerCore] 스캐너 시작 완료');
            } else {
                throw new Error('사용 가능한 카메라가 없습니다');
            }
        } catch (err) {
            console.error('[ScannerCore] 스캐너 시작 오류:', err);
            this.updateStatus(`오류: ${err.message || err}`);
            this.isScanning = false;
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
                    facingMode: "environment"
                },
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                },
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.DATA_MATRIX,
                    Html5QrcodeSupportedFormats.AZTEC,
                    Html5QrcodeSupportedFormats.PDF_417
                ]
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