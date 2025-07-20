// 설정 기본값
const defaultSettings = {
    systemName: 'QR 입장 관리 시스템',
    defaultLanguage: 'ko',
    timezone: 'Asia/Seoul',
    qrSize: '300',
    qrErrorLevel: 'M',
    qrFormat: 'simple',
    preventDuplicateCheckin: true,
    checkinSound: true,
    recordCheckinTime: true,
    autoBackup: true,
    backupRetention: '30'
};

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
});

// 설정 로드
function loadSettings() {
    const savedSettings = localStorage.getItem('systemSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;
    
    // 각 설정 값 적용
    document.getElementById('systemName').value = settings.systemName;
    document.getElementById('defaultLanguage').value = settings.defaultLanguage;
    document.getElementById('timezone').value = settings.timezone;
    document.getElementById('qrSize').value = settings.qrSize;
    document.getElementById('qrErrorLevel').value = settings.qrErrorLevel;
    document.getElementById('qrFormat').value = settings.qrFormat;
    document.getElementById('preventDuplicateCheckin').checked = settings.preventDuplicateCheckin;
    document.getElementById('checkinSound').checked = settings.checkinSound;
    document.getElementById('recordCheckinTime').checked = settings.recordCheckinTime;
    document.getElementById('autoBackup').checked = settings.autoBackup;
    document.getElementById('backupRetention').value = settings.backupRetention;
}

// 설정 저장
function saveSettings() {
    const settings = {
        systemName: document.getElementById('systemName').value,
        defaultLanguage: document.getElementById('defaultLanguage').value,
        timezone: document.getElementById('timezone').value,
        qrSize: document.getElementById('qrSize').value,
        qrErrorLevel: document.getElementById('qrErrorLevel').value,
        qrFormat: document.getElementById('qrFormat').value,
        preventDuplicateCheckin: document.getElementById('preventDuplicateCheckin').checked,
        checkinSound: document.getElementById('checkinSound').checked,
        recordCheckinTime: document.getElementById('recordCheckinTime').checked,
        autoBackup: document.getElementById('autoBackup').checked,
        backupRetention: document.getElementById('backupRetention').value
    };
    
    // localStorage에 저장
    localStorage.setItem('systemSettings', JSON.stringify(settings));
    
    // 성공 메시지 표시
    showToast('설정이 저장되었습니다', 'success');
    
    // 시스템 이름이 변경된 경우 페이지 새로고침
    const currentSettings = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    if (currentSettings.systemName !== settings.systemName) {
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기값으로 되돌리시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        // 기본 설정으로 복원
        localStorage.setItem('systemSettings', JSON.stringify(defaultSettings));
        
        // 페이지 새로고침
        showToast('설정이 초기화되었습니다', 'success');
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
}

// 설정 값 가져오기 (다른 페이지에서 사용)
function getSettings() {
    const savedSettings = localStorage.getItem('systemSettings');
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
}

// 특정 설정 값 가져오기
function getSetting(key) {
    const settings = getSettings();
    return settings[key] !== undefined ? settings[key] : defaultSettings[key];
}

// 전역 함수 노출
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.getSettings = getSettings;
window.getSetting = getSetting;