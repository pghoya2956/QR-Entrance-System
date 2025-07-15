/**
 * 오디오 피드백 모듈
 * Web Audio API를 사용한 비프음 생성
 */

class AudioFeedback {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
    }

    // 오디오 컨텍스트 초기화 (사용자 인터랙션 후 호출)
    init() {
        if (this.initialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
            console.log('오디오 피드백 초기화 완료');
        } catch (error) {
            console.error('오디오 컨텍스트 초기화 실패:', error);
        }
    }

    // 기본 비프음 재생
    playBeep(frequency = 440, duration = 200, volume = 0.3) {
        if (!this.initialized) {
            this.init();
        }

        if (!this.audioContext) {
            console.warn('오디오 컨텍스트를 사용할 수 없습니다');
            return;
        }

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            const now = this.audioContext.currentTime;
            
            // 부드러운 시작과 끝
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);
            
            oscillator.start(now);
            oscillator.stop(now + duration / 1000);
        } catch (error) {
            console.error('비프음 재생 오류:', error);
        }
    }

    // 성공 사운드 (짧고 높은음)
    success() {
        this.playBeep(880, 150, 0.3);
    }

    // 실패 사운드 (낮고 긴음)
    error() {
        this.playBeep(200, 500, 0.3);
    }

    // 네트워크 오류 사운드 (3회 반복)
    networkError() {
        this.playBeep(440, 100, 0.3);
        setTimeout(() => this.playBeep(440, 100, 0.3), 150);
        setTimeout(() => this.playBeep(440, 100, 0.3), 300);
    }

    // 경고 사운드 (중간음)
    warning() {
        this.playBeep(440, 300, 0.3);
    }

    // 중복 스캔 사운드 (짧은 경고음)
    duplicate() {
        this.playBeep(660, 100, 0.2);
    }
}

// 전역 인스턴스 생성
const audioFeedback = new AudioFeedback();

// 페이지 로드 시 초기화 시도
document.addEventListener('DOMContentLoaded', () => {
    // 첫 사용자 인터랙션 시 초기화
    document.addEventListener('click', () => {
        audioFeedback.init();
    }, { once: true });
});