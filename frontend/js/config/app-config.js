/**
 * 애플리케이션 전역 설정
 * 기존 코드와의 호환성을 유지하면서 점진적으로 마이그레이션
 */

const AppConfig = {
    // API 설정
    api: {
        baseUrl: window.location.hostname === 'localhost' && window.location.port === '8080' 
            ? 'http://localhost:5001/api' 
            : '/api',
        timeout: 30000,
        retryCount: 3,
        retryDelay: 1000
    },
    
    // QR 스캐너 설정
    scanner: {
        cooldown: 5000, // 5초로 증가 (중복 스캔 방지)
        qrbox: { width: 500, height: 500 }, // 기존 200에서 500으로 확대
        fps: 10,
        aspectRatio: 1.0,
        // 전체화면 모드 설정
        fullscreen: {
            qrbox: { width: 700, height: 700 }, // 전체화면에서는 더 크게
            showViewFinder: true,
            viewfinderBorder: '4px solid #3498db'
        }
    },
    
    // UI 설정
    ui: {
        animationDuration: 300,
        toastDuration: 3000,
        modalBackdropOpacity: 0.5,
        // 카메라 거리 안내
        cameraDistance: {
            minDistance: 30, // cm
            maxDistance: 50, // cm
            showGuide: true
        }
    },
    
    // 오디오 피드백 설정
    audio: {
        enabled: true,
        volume: 0.5,
        sounds: {
            success: 'success.mp3',
            error: 'error.mp3',
            warning: 'warning.mp3'
        }
    },
    
    // 데이터 설정
    data: {
        cacheTimeout: 5 * 60 * 1000, // 5분
        batchSize: 100,
        maxRetries: 3
    }
};

// 기존 코드와의 호환성을 위한 전역 변수 설정
window.SCAN_COOLDOWN = AppConfig.scanner.cooldown;
window.QR_BOX_SIZE = AppConfig.scanner.qrbox;
window.API_TIMEOUT = AppConfig.api.timeout;

// 설정 헬퍼 함수
const ConfigHelper = {
    // 전체화면 모드인지 확인
    isFullscreen() {
        return document.fullscreenElement || 
               document.webkitFullscreenElement || 
               document.mozFullScreenElement || 
               document.msFullscreenElement;
    },
    
    // 현재 스캐너 설정 가져오기
    getScannerConfig() {
        const isFullscreen = this.isFullscreen();
        return {
            ...AppConfig.scanner,
            qrbox: isFullscreen ? 
                AppConfig.scanner.fullscreen.qrbox : 
                AppConfig.scanner.qrbox
        };
    },
    
    // API 엔드포인트 URL 생성
    getApiUrl(endpoint) {
        return `${AppConfig.api.baseUrl}${endpoint}`;
    },
    
    // 카메라 거리 가이드 표시 여부
    shouldShowCameraGuide() {
        return AppConfig.ui.cameraDistance.showGuide;
    }
};

// 전역으로 내보내기
window.AppConfig = AppConfig;
window.ConfigHelper = ConfigHelper;