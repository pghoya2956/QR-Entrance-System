// 전역 변수
let backupInterval = null;

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    currentEventId = localStorage.getItem('selectedEventId') || null;
    
    // 이벤트 목록 로드
    await loadEventOptions();
    
    // 백업 정보 초기화
    await initializeBackup();
    
    // 30초마다 자동 새로고침
    backupInterval = setInterval(() => {
        refreshBackupInfo();
    }, 30000);
});

// 이벤트 옵션 로드
async function loadEventOptions() {
    try {
        // 이벤트 목록은 event_id가 필요없으므로 직접 호출
        const response = await fetch('/api/events');
        if (response.ok) {
            const events = await response.json();
            const selectElement = document.getElementById('eventSelect');
            
            selectElement.innerHTML = '<option value="">이벤트 선택</option>';
            events.forEach(event => {
                const option = document.createElement('option');
                option.value = event.eventId;
                option.textContent = event.eventName;
                if (event.eventId === currentEventId) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });
        }
    } catch (error) {
        console.error('이벤트 목록 로드 실패:', error);
    }
}

// 이벤트 변경 처리
function handleEventChange() {
    const selectElement = document.getElementById('eventSelect');
    const eventId = selectElement.value;
    
    if (eventId) {
        currentEventId = eventId;
        localStorage.setItem('selectedEventId', eventId);
        refreshBackupInfo();
    }
}

// 백업 초기화
async function initializeBackup() {
    await loadBackupInfo();
    await loadBackupList();
}

// 백업 정보 로드
async function loadBackupInfo() {
    if (!currentEventId) {
        showToast('이벤트를 선택해주세요', 'warning');
        return;
    }
    
    try {
        // 백업 목록 가져오기
        const response = await fetch(getApiUrl('/admin/backups'));
        if (response.ok) {
            const backups = await response.json();
            updateBackupStats(backups);
        }
    } catch (error) {
        console.error('백업 정보 로드 실패:', error);
        document.getElementById('lastBackupTime').textContent = '확인 실패';
        document.getElementById('backupCount').textContent = '0';
        document.getElementById('totalSize').textContent = '0 MB';
    }
}

// 백업 통계 업데이트
function updateBackupStats(backups) {
    // 백업 개수
    document.getElementById('backupCount').textContent = backups.length;
    
    // 마지막 백업 시간
    if (backups.length > 0) {
        const lastBackup = backups[0]; // 최신순으로 정렬되어 있다고 가정
        const lastBackupDate = new Date(lastBackup.createdAt);
        const timeAgo = getTimeAgo(lastBackupDate);
        document.getElementById('lastBackupTime').textContent = timeAgo;
    } else {
        document.getElementById('lastBackupTime').textContent = '백업 없음';
    }
    
    // 총 크기 계산
    const totalBytes = backups.reduce((sum, backup) => sum + (backup.size || 0), 0);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    document.getElementById('totalSize').textContent = `${totalMB} MB`;
}

// 시간 경과 계산
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}일 전`;
    } else if (hours > 0) {
        return `${hours}시간 전`;
    } else if (minutes > 0) {
        return `${minutes}분 전`;
    } else {
        return '방금 전';
    }
}

// 백업 목록 로드
async function loadBackupList() {
    if (!currentEventId) {
        showEmptyState();
        return;
    }
    
    const listElement = document.getElementById('backupList');
    const loadingElement = document.getElementById('loadingState');
    const emptyElement = document.getElementById('emptyState');
    
    // 로딩 상태 표시
    listElement.style.display = 'none';
    emptyElement.style.display = 'none';
    loadingElement.style.display = 'flex';
    
    try {
        const response = await fetch(getApiUrl('/admin/backups'));
        if (response.ok) {
            const backups = await response.json();
            
            loadingElement.style.display = 'none';
            
            if (backups.length === 0) {
                showEmptyState();
            } else {
                displayBackupList(backups);
            }
        } else {
            throw new Error('백업 목록 로드 실패');
        }
    } catch (error) {
        console.error('백업 목록 로드 실패:', error);
        loadingElement.style.display = 'none';
        showEmptyState();
        showToast('백업 목록을 불러올 수 없습니다', 'error');
    }
}

// 백업 목록 표시
function displayBackupList(backups) {
    const listElement = document.getElementById('backupList');
    const emptyElement = document.getElementById('emptyState');
    
    emptyElement.style.display = 'none';
    listElement.style.display = 'flex';
    
    listElement.innerHTML = backups.map(backup => {
        const createdAt = new Date(backup.createdAt);
        const dateString = createdAt.toLocaleDateString('ko-KR');
        const timeString = createdAt.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const sizeKB = (backup.size / 1024).toFixed(1);
        
        return `
            <div class="backup-item">
                <div class="backup-item-info">
                    <div class="backup-item-name">${backup.filename}</div>
                    <div class="backup-item-details">
                        <div class="backup-item-detail">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            ${dateString}
                        </div>
                        <div class="backup-item-detail">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            ${timeString}
                        </div>
                        <div class="backup-item-detail">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                            </svg>
                            ${sizeKB} KB
                        </div>
                    </div>
                </div>
                <div class="backup-item-actions">
                    <button class="btn btn-outline btn-sm" onclick="downloadBackup('${backup.filename}')" title="다운로드">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                        </svg>
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="restoreBackup('${backup.filename}')" title="복원">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                        </svg>
                    </button>
                    <button class="btn btn-outline btn-sm danger" onclick="deleteBackup('${backup.filename}')" title="삭제">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 빈 상태 표시
function showEmptyState() {
    const listElement = document.getElementById('backupList');
    const emptyElement = document.getElementById('emptyState');
    
    listElement.style.display = 'none';
    emptyElement.style.display = 'flex';
}

// 백업 생성
async function createBackup() {
    if (!currentEventId) {
        showToast('이벤트를 선택해주세요', 'warning');
        return;
    }
    
    try {
        showToast('백업을 생성하는 중...', 'info');
        
        const response = await fetch(getApiUrl('/admin/backup'), {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast('백업이 성공적으로 생성되었습니다', 'success');
            
            // 백업 정보 및 목록 새로고침
            await refreshBackupInfo();
        } else {
            throw new Error('백업 생성 실패');
        }
    } catch (error) {
        console.error('백업 생성 실패:', error);
        showToast('백업 생성에 실패했습니다', 'error');
    }
}

// 백업 다운로드
async function downloadBackup(filename) {
    try {
        const response = await fetch(getApiUrl(`/admin/backup/download/${filename}`));
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showToast('백업 다운로드가 시작되었습니다', 'success');
        } else {
            throw new Error('백업 다운로드 실패');
        }
    } catch (error) {
        console.error('백업 다운로드 실패:', error);
        showToast('백업 다운로드에 실패했습니다', 'error');
    }
}

// 백업 복원
async function restoreBackup(filename) {
    if (!confirm(`정말로 "${filename}" 백업을 복원하시겠습니까?\n현재 데이터가 백업 시점의 데이터로 대체됩니다.`)) {
        return;
    }
    
    try {
        showToast('백업을 복원하는 중...', 'info');
        
        const response = await fetch(getApiUrl(`/admin/backup/restore/${filename}`), {
            method: 'POST'
        });
        
        if (response.ok) {
            showToast('백업이 성공적으로 복원되었습니다', 'success');
            
            // 페이지 새로고침
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            throw new Error('백업 복원 실패');
        }
    } catch (error) {
        console.error('백업 복원 실패:', error);
        showToast('백업 복원에 실패했습니다', 'error');
    }
}

// 백업 삭제
async function deleteBackup(filename) {
    if (!confirm(`정말로 "${filename}" 백업을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }
    
    try {
        const response = await fetch(getApiUrl(`/admin/backup/${filename}`), {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('백업이 삭제되었습니다', 'success');
            
            // 백업 정보 및 목록 새로고침
            await refreshBackupInfo();
        } else {
            throw new Error('백업 삭제 실패');
        }
    } catch (error) {
        console.error('백업 삭제 실패:', error);
        showToast('백업 삭제에 실패했습니다', 'error');
    }
}

// 백업 정보 새로고침
async function refreshBackupInfo() {
    await loadBackupInfo();
    await loadBackupList();
}

// 백업 목록 새로고침
async function refreshBackupList() {
    await loadBackupList();
}

// 페이지 언로드 시 interval 정리
window.addEventListener('beforeunload', () => {
    if (backupInterval) {
        clearInterval(backupInterval);
    }
});

// 전역 함수 노출
window.handleEventChange = handleEventChange;
window.createBackup = createBackup;
window.downloadBackup = downloadBackup;
window.restoreBackup = restoreBackup;
window.deleteBackup = deleteBackup;
window.refreshBackupList = refreshBackupList;