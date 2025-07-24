/**
 * API 서비스 - 기존 api 객체를 대체하는 향상된 버전
 * 기존 코드와의 100% 호환성 유지
 */

class APIService {
    constructor() {
        this.baseUrl = AppConfig.api.baseUrl;
        this.timeout = AppConfig.api.timeout;
        this.retryCount = AppConfig.api.retryCount;
        this.retryDelay = AppConfig.api.retryDelay;
        
        // 로딩 상태 관리
        this.loadingCount = 0;
        
        // 에러 핸들러
        this.errorHandlers = new Map();
    }
    
    // API URL 생성 (event_id 파라미터 포함)
    getApiUrl(path) {
        if (!currentEventId) {
            throw new Error('이벤트가 선택되지 않았습니다.');
        }
        const separator = path.includes('?') ? '&' : '?';
        return `${this.baseUrl}${path}${separator}event_id=${currentEventId}`;
    }
    
    // 재시도 로직이 포함된 fetch
    async fetchWithRetry(url, options = {}, retries = this.retryCount) {
        try {
            this.showLoading();
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            // 인증 토큰 추가
            const token = localStorage.getItem('authToken');
            const headers = {
                ...options.headers,
                'Authorization': token ? `Bearer ${token}` : undefined
            };
            
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // 401 에러시 로그인 페이지로 리다이렉션
            if (response.status === 401) {
                const currentPath = window.location.pathname + window.location.search;
                window.location.href = `/login.html?returnUrl=${encodeURIComponent(currentPath)}`;
                return;
            }
            
            // 409 Conflict는 재시도하지 않음 (이미 체크인된 상태)
            // 404 Not Found도 재시도하지 않음 (등록되지 않은 사용자)
            if (response.status === 409 || response.status === 404) {
                return response;
            }
            
            if (!response.ok && retries > 0) {
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.fetchWithRetry(url, options, retries - 1);
            }
            
            return response;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('요청 시간이 초과되었습니다.');
            }
            
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.fetchWithRetry(url, options, retries - 1);
            }
            
            throw error;
        } finally {
            this.hideLoading();
        }
    }
    
    // 로딩 표시
    showLoading() {
        this.loadingCount++;
        if (this.loadingCount === 1) {
            const loader = document.getElementById('globalLoader');
            if (loader) loader.style.display = 'block';
        }
    }
    
    // 로딩 숨기기
    hideLoading() {
        this.loadingCount--;
        if (this.loadingCount === 0) {
            const loader = document.getElementById('globalLoader');
            if (loader) loader.style.display = 'none';
        }
    }
    
    // 에러 처리
    handleError(error, context) {
        console.error(`[API Error - ${context}]:`, error);
        
        if (error.message.includes('이벤트가 선택되지 않았습니다')) {
            showToast('이벤트를 먼저 선택해주세요.', 'error');
        } else if (error.message.includes('시간이 초과되었습니다')) {
            showToast('네트워크 연결이 느립니다. 다시 시도해주세요.', 'error');
        } else {
            const customHandler = this.errorHandlers.get(context);
            if (customHandler) {
                customHandler(error);
            } else {
                showToast(`${context}: ${error.message}`, 'error');
            }
        }
    }
    
    // === 기존 api 객체와 동일한 메서드들 ===
    
    async getAttendees() {
        try {
            const response = await this.fetchWithRetry(this.getApiUrl('/admin/attendees'));
            if (!response.ok) throw new Error('Failed to fetch attendees');
            return await response.json();
        } catch (error) {
            this.handleError(error, '참가자 목록을 불러올 수 없습니다');
            throw error;
        }
    }
    
    async getStats() {
        try {
            const response = await this.fetchWithRetry(this.getApiUrl('/admin/stats'));
            if (!response.ok) throw new Error('Failed to fetch stats');
            return await response.json();
        } catch (error) {
            this.handleError(error, '통계 정보를 불러올 수 없습니다');
            throw error;
        }
    }
    
    async toggleCheckin(registrationNumber) {
        try {
            const response = await this.fetchWithRetry(
                this.getApiUrl(`/admin/attendee/${registrationNumber}/toggle-checkin`),
                { method: 'PUT' }
            );
            if (!response.ok) throw new Error('Failed to toggle checkin');
            return await response.json();
        } catch (error) {
            this.handleError(error, '체크인 상태 변경 실패');
            throw error;
        }
    }
    
    async verifyCheckin(qrData) {
        try {
            const response = await this.fetchWithRetry(
                this.getApiUrl('/checkin/verify'),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ qrData })
                }
            );
            
            const result = await response.json();
            
            if (!response.ok) {
                // 409 Conflict는 정상적인 중복 체크인 응답으로 처리
                if (response.status === 409) {
                    return {
                        success: false,
                        status: response.status,
                        error: '이미 체크인되었습니다',
                        attendeeInfo: result.attendeeInfo || result.attendee,
                        ...result
                    };
                }
                
                return {
                    success: false,
                    status: response.status,
                    ...result
                };
            }
            
            return {
                success: true,
                ...result
            };
        } catch (error) {
            this.handleError(error, '체크인 검증 실패');
            throw error;
        }
    }
    
    async downloadCSV() {
        try {
            const response = await this.fetchWithRetry(this.getApiUrl('/admin/export-csv'));
            if (!response.ok) throw new Error('Failed to download CSV');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendees_${currentEventId}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast('CSV 파일 다운로드 완료', 'success');
        } catch (error) {
            this.handleError(error, 'CSV 다운로드 실패');
            throw error;
        }
    }
    
    async uploadCSV(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await this.fetchWithRetry(
                this.getApiUrl('/admin/import-csv'),
                {
                    method: 'POST',
                    body: formData
                }
            );
            
            if (!response.ok) throw new Error('Failed to upload CSV');
            return await response.json();
        } catch (error) {
            this.handleError(error, 'CSV 업로드 실패');
            throw error;
        }
    }
    
    async addAttendee(attendee) {
        try {
            const response = await this.fetchWithRetry(
                this.getApiUrl('/admin/attendees'),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(attendee)
                }
            );
            
            if (!response.ok) throw new Error('Failed to add attendee');
            return await response.json();
        } catch (error) {
            this.handleError(error, '참가자 추가 실패');
            throw error;
        }
    }
    
    async addAttendeesBulk(attendees) {
        try {
            const response = await this.fetchWithRetry(
                this.getApiUrl('/admin/attendees/bulk'),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ attendees })
                }
            );
            
            if (!response.ok) throw new Error('Failed to bulk add attendees');
            return await response.json();
        } catch (error) {
            this.handleError(error, '일괄 추가 실패');
            throw error;
        }
    }
    
    async deleteAttendee(registrationNumber) {
        try {
            const response = await this.fetchWithRetry(
                this.getApiUrl(`/admin/attendees/${registrationNumber}`),
                { method: 'DELETE' }
            );
            
            if (!response.ok) throw new Error('Failed to delete attendee');
            return await response.json();
        } catch (error) {
            this.handleError(error, '참가자 삭제 실패');
            throw error;
        }
    }
    
    async resetAllCheckins() {
        try {
            const response = await this.fetchWithRetry(
                this.getApiUrl('/admin/reset'),
                { method: 'POST' }
            );
            
            if (!response.ok) throw new Error('Failed to reset checkins');
            return await response.json();
        } catch (error) {
            this.handleError(error, '체크인 초기화 실패');
            throw error;
        }
    }
    
    async downloadQRCode(registrationNumber, attendeeName) {
        try {
            const response = await this.fetchWithRetry(
                this.getApiUrl(`/admin/attendee/${registrationNumber}/qr`)
            );
            
            if (!response.ok) throw new Error('Failed to get QR code');
            
            const data = await response.json();
            
            // QR 코드 이미지 다운로드
            const link = document.createElement('a');
            link.href = data.qrCode;
            link.download = `QR_${attendeeName}_${registrationNumber}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            this.handleError(error, 'QR 코드 다운로드 실패');
            throw error;
        }
    }
    
    async downloadAllQRCodes(attendees) {
        try {
            const response = await this.fetchWithRetry(
                this.getApiUrl('/admin/qr-codes/download-all'),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ attendees })
                }
            );
            
            if (!response.ok) throw new Error('Failed to download QR codes');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `qr_codes_${currentEventId}_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast('QR 코드 다운로드 완료', 'success');
        } catch (error) {
            this.handleError(error, 'QR 코드 일괄 다운로드 실패');
            throw error;
        }
    }
}

// 전역 api 객체 생성 (기존 코드와의 호환성)
window.apiService = new APIService();

// 기존 api 객체 래핑
window.api = {
    getAttendees: () => apiService.getAttendees(),
    getStats: () => apiService.getStats(),
    toggleCheckin: (regNum) => apiService.toggleCheckin(regNum),
    verifyCheckin: (qrData) => apiService.verifyCheckin(qrData),
    downloadCSV: () => apiService.downloadCSV(),
    uploadCSV: (file) => apiService.uploadCSV(file),
    addAttendee: (attendee) => apiService.addAttendee(attendee),
    bulkAddAttendees: (attendees) => apiService.bulkAddAttendees(attendees),
    deleteAttendee: (regNum) => apiService.deleteAttendee(regNum),
    resetAllCheckins: () => apiService.resetAllCheckins(),
    downloadQRCode: (regNum, name) => apiService.downloadQRCode(regNum, name),
    downloadAllQRCodes: (attendees) => apiService.downloadAllQRCodes(attendees)
};