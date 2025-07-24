/**
 * 로그인 페이지 스크립트
 */

// DOM 요소
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const passwordError = document.getElementById('passwordError');
const loginButton = document.getElementById('loginButton');
const errorAlert = document.getElementById('errorAlert');
const successAlert = document.getElementById('successAlert');

// API URL 설정
const API_BASE_URL = window.location.hostname === 'localhost' && window.location.port === '8080' 
    ? 'http://localhost:5001/api' 
    : (window.AppConfig ? AppConfig.api.baseUrl : '/api');

// 이미 로그인되어 있는지 확인
async function checkAuthStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/check`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                // 이미 로그인되어 있으면 메인 페이지로 리다이렉션
                const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/';
                window.location.href = returnUrl;
            }
        }
    } catch (error) {
        console.error('인증 상태 확인 실패:', error);
    }
}

// 페이지 로드 시 인증 상태 확인
checkAuthStatus();

// 폼 제출 처리
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 에러 메시지 초기화
    hideAllAlerts();
    passwordInput.classList.remove('error');
    passwordError.classList.remove('show');
    
    // 유효성 검사
    const password = passwordInput.value.trim();
    if (!password) {
        passwordInput.classList.add('error');
        passwordError.classList.add('show');
        passwordInput.focus();
        return;
    }
    
    // 로딩 상태
    loginButton.disabled = true;
    loginButton.classList.add('loading');
    loginButton.textContent = '로그인 중...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            mode: 'cors', // Safari를 위한 명시적 CORS 모드
            body: JSON.stringify({ password })
        });
        
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.error('JSON 파싱 오류:', jsonError);
            throw new Error('서버 응답을 처리할 수 없습니다');
        }
        
        if (response.ok) {
            // 로그인 성공
            showAlert('success', '로그인되었습니다. 잠시 후 페이지로 이동합니다.');
            
            // 토큰을 localStorage에도 저장 (API 요청용)
            if (data.token) {
                localStorage.setItem('authToken', data.token);
            }
            
            // 1초 후 리다이렉션
            setTimeout(() => {
                const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/';
                window.location.href = returnUrl;
            }, 1000);
        } else {
            // 로그인 실패
            showAlert('error', data.error || '로그인에 실패했습니다.');
            passwordInput.focus();
            passwordInput.select();
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        const errorMessage = error.message || '서버와의 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
        showAlert('error', `로그인 오류: ${errorMessage}`);
    } finally {
        // 로딩 상태 해제
        loginButton.disabled = false;
        loginButton.classList.remove('loading');
        loginButton.textContent = '로그인';
    }
});

// 비밀번호 입력 시 에러 상태 제거
passwordInput.addEventListener('input', () => {
    if (passwordInput.value.trim()) {
        passwordInput.classList.remove('error');
        passwordError.classList.remove('show');
    }
});

// Enter 키로 로그인
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !loginButton.disabled) {
        loginForm.dispatchEvent(new Event('submit'));
    }
});

// 알림 메시지 표시
function showAlert(type, message) {
    const alert = type === 'error' ? errorAlert : successAlert;
    alert.textContent = message;
    alert.classList.add('show');
}

// 모든 알림 숨기기
function hideAllAlerts() {
    errorAlert.classList.remove('show');
    successAlert.classList.remove('show');
}

// 페이지 포커스 시 비밀번호 입력창에 포커스
window.addEventListener('focus', () => {
    if (!loginButton.disabled && passwordInput.value === '') {
        passwordInput.focus();
    }
});

// 초기 포커스
passwordInput.focus();