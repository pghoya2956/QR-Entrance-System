/**
 * 참가자 관리 페이지 JavaScript
 */

let allAttendees = [];
let currentFilter = 'all';
let currentSearch = '';

// 참가자 목록 로드
async function loadAttendees() {
    try {
        allAttendees = await api.getAttendees();
        renderAttendees();
    } catch (error) {
        console.error('참가자 목록 로딩 실패:', error);
        showToast('참가자 목록을 불러올 수 없습니다.', 'error');
    }
}

// 통계 로드
async function loadStats() {
    try {
        const stats = await api.getStats();
        updateStatsDisplay(stats);
    } catch (error) {
        console.error('통계 로딩 실패:', error);
    }
}

// 참가자 목록 렌더링
function renderAttendees() {
    const tbody = document.getElementById('attendeesTableBody');
    tbody.innerHTML = '';
    
    // 필터링 적용
    let filteredAttendees = filterByCheckinStatus(allAttendees, currentFilter);
    filteredAttendees = filterAttendees(filteredAttendees, currentSearch);
    
    // 테이블에 행 추가
    filteredAttendees.forEach(attendee => {
        const tr = document.createElement('tr');
        const isCheckedIn = attendee['체크인'] === 'true';
        
        tr.innerHTML = `
            <td>${attendee['등록번호']}</td>
            <td class="editable" ondblclick="enableCellEdit('${attendee['등록번호']}', '고객명', this)">${attendee['고객명']}</td>
            <td class="editable" ondblclick="enableCellEdit('${attendee['등록번호']}', '회사명', this)">${attendee['회사명']}</td>
            <td class="editable" ondblclick="enableCellEdit('${attendee['등록번호']}', '연락처', this)">${attendee['연락처']}</td>
            <td class="editable" ondblclick="enableCellEdit('${attendee['등록번호']}', '이메일', this)">${attendee['이메일']}</td>
            <td class="editable" ondblclick="enableCellEdit('${attendee['등록번호']}', '초대/현장방문', this)">
                <span class="attendee-type">${attendee['초대/현장방문']}</span>
            </td>
            <td>${formatDate(attendee['체크인시간'])}</td>
            <td>
                <div class="checkin-toggle ${isCheckedIn ? 'checked' : ''}" 
                     data-registration="${attendee['등록번호']}"
                     onclick="toggleAttendeeCheckin('${attendee['등록번호']}')">
                    ${isCheckedIn ? '✓' : '○'}
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-generate-qr" 
                            onclick="generateQRCode('${attendee['등록번호']}', '${attendee['고객명']}')">
                        QR
                    </button>
                    <button class="btn btn-sm btn-delete" 
                            onclick="deleteAttendee('${attendee['등록번호']}')">
                        삭제
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// 체크인 토글
async function toggleAttendeeCheckin(registrationNumber) {
    try {
        const result = await api.toggleCheckin(registrationNumber);
        
        if (result.success) {
            // 로컬 데이터 업데이트
            const attendeeIndex = allAttendees.findIndex(a => a['등록번호'] === registrationNumber);
            if (attendeeIndex !== -1) {
                allAttendees[attendeeIndex] = result.attendee;
            }
            
            // UI 업데이트
            renderAttendees();
            await loadStats();
            
            showToast(result.message, 'success');
        }
    } catch (error) {
        console.error('체크인 토글 실패:', error);
        showToast('체크인 상태 변경에 실패했습니다.', 'error');
    }
}

// 인라인 편집 기능
function enableCellEdit(registrationNumber, field, cell) {
    const currentValue = cell.textContent.trim();
    const originalHTML = cell.innerHTML;
    
    // 입력 필드로 변환
    cell.innerHTML = `
        <input type="text" 
               class="cell-edit-input"
               value="${currentValue}"
               data-original="${currentValue}"
               onblur="saveEdit('${registrationNumber}', '${field}', this)"
               onkeyup="handleEditKeyup(event, '${registrationNumber}', '${field}', this)">
    `;
    
    const input = cell.querySelector('input');
    input.focus();
    input.select();
}

// 편집 키보드 이벤트 처리
function handleEditKeyup(event, registrationNumber, field, input) {
    if (event.key === 'Enter') {
        input.blur();
    } else if (event.key === 'Escape') {
        const cell = input.parentElement;
        cell.innerHTML = input.getAttribute('data-original');
    }
}

// 편집 내용 저장
async function saveEdit(registrationNumber, field, input) {
    const newValue = input.value.trim();
    const originalValue = input.getAttribute('data-original');
    const cell = input.parentElement;
    
    // 값이 변경되지 않았으면 원래대로
    if (newValue === originalValue) {
        cell.textContent = originalValue;
        return;
    }
    
    try {
        const response = await api.updateAttendee(registrationNumber, {
            [field]: newValue
        });
        
        if (response.success) {
            // 성공 시 새 값으로 업데이트
            if (field === '초대/현장방문') {
                cell.innerHTML = `<span class="attendee-type">${newValue}</span>`;
            } else {
                cell.textContent = newValue;
            }
            showToast('수정되었습니다', 'success');
            
            // 로컬 데이터도 업데이트
            const attendeeIndex = allAttendees.findIndex(a => a['등록번호'] === registrationNumber);
            if (attendeeIndex !== -1) {
                allAttendees[attendeeIndex][field] = newValue;
            }
        }
    } catch (error) {
        // 실패 시 원래 값으로 복원
        if (field === '초대/현장방문') {
            cell.innerHTML = `<span class="attendee-type">${originalValue}</span>`;
        } else {
            cell.textContent = originalValue;
        }
        showToast('수정 실패: ' + error.message, 'error');
    }
}

// 참가자 삭제
async function deleteAttendee(registrationNumber) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        const response = await api.deleteAttendee(registrationNumber);
        
        if (response.success) {
            showToast('삭제되었습니다', 'success');
            await loadAttendees();
            await loadStats();
        }
    } catch (error) {
        showToast('삭제 실패: ' + error.message, 'error');
    }
}

// 참가자 추가 모달 표시
async function showAddAttendeeModal() {
    const modal = document.getElementById('addAttendeeModal');
    modal.style.display = 'block';
    
    // 동적 폼 생성
    await createAddAttendeeForm();
}

// 참가자 추가 모달 닫기
function closeAddAttendeeModal() {
    const modal = document.getElementById('addAttendeeModal');
    modal.style.display = 'none';
    
    // 폼 초기화
    document.getElementById('addAttendeeForm').reset();
    document.getElementById('bulkAddData').value = '';
    document.getElementById('bulkAddResult').style.display = 'none';
    
    // CSV 탭 초기화
    cancelCSVUpload();
    
    // 첫 번째 탭으로 돌아가기
    document.querySelectorAll('.tab-button').forEach((btn, index) => {
        btn.classList.toggle('active', index === 0);
    });
    document.querySelectorAll('.tab-content').forEach((content, index) => {
        content.style.display = index === 0 ? 'block' : 'none';
    });
}

// 탭 전환
function switchTab(tabName) {
    // 탭 버튼 활성화 상태 변경
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 탭 컨텐츠 표시/숨김
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    if (tabName === 'individual') {
        document.getElementById('individualTab').style.display = 'block';
    } else if (tabName === 'bulk') {
        document.getElementById('bulkTab').style.display = 'block';
    } else if (tabName === 'csv') {
        document.getElementById('csvTab').style.display = 'block';
    }
}

// 동적 폼 생성
async function createAddAttendeeForm() {
    try {
        const eventInfo = await api.getEventInfo();
        const fields = eventInfo.csvFields;
        const required = eventInfo.requiredFields;
        
        let formHTML = '';
        fields.forEach(field => {
            // 자동 생성 필드 제외
            if (['체크인', '체크인시간'].includes(field)) return;
            
            const isRequired = required.includes(field);
            const isRegistrationNumber = field === '등록번호';
            
            formHTML += `
                <div class="form-group">
                    <label>${field} ${isRequired && !isRegistrationNumber ? '*' : ''}</label>
                    <input type="${field === '이메일' ? 'email' : 'text'}" 
                           name="${field}" 
                           ${isRequired && !isRegistrationNumber ? 'required' : ''}
                           ${isRegistrationNumber ? 'placeholder="비워두면 자동 생성됩니다"' : `placeholder="${getFieldPlaceholder(field)}"`}>
                </div>
            `;
        });
        
        document.getElementById('dynamicFormFields').innerHTML = formHTML;
    } catch (error) {
        console.error('폼 생성 실패:', error);
        showToast('폼 생성에 실패했습니다', 'error');
    }
}

// 필드별 플레이스홀더
function getFieldPlaceholder(field) {
    const placeholders = {
        '고객명': '홍길동',
        '회사명': 'ABC 회사',
        '연락처': '010-1234-5678',
        '이메일': 'hong@example.com',
        '초대/현장방문': '초대',
        '직책': '대리',
        '관심분야': '기술'
    };
    return placeholders[field] || field;
}

// 개별 추가 처리
async function handleAddAttendee(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const attendeeData = {};
    
    for (let [key, value] of formData.entries()) {
        if (value.trim()) {
            attendeeData[key] = value.trim();
        }
    }
    
    try {
        const result = await api.addAttendee(attendeeData);
        
        if (result.success) {
            showToast('참가자가 추가되었습니다', 'success');
            
            // QR 코드 표시
            if (result.qrCode) {
                displayQRCode(result.qrCode, result.attendee['고객명']);
            }
            
            // 목록 새로고침
            await loadAttendees();
            await loadStats();
            
            // 모달 닫기
            closeAddAttendeeModal();
        }
    } catch (error) {
        showToast('추가 실패: ' + error.message, 'error');
    }
}

// 일괄 추가 처리
async function handleBulkAdd() {
    const textarea = document.getElementById('bulkAddData');
    const lines = textarea.value.trim().split('\n');
    
    if (lines.length < 2) {
        showToast('헤더와 데이터를 포함해 입력하세요', 'error');
        return;
    }
    
    // 첫 줄은 헤더
    const headers = lines[0].split('\t').map(h => h.trim());
    const attendees = [];
    
    // 데이터 파싱
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split('\t');
        const attendee = {};
        
        headers.forEach((header, index) => {
            attendee[header] = values[index]?.trim() || '';
        });
        
        attendees.push(attendee);
    }
    
    if (attendees.length === 0) {
        showToast('추가할 데이터가 없습니다', 'error');
        return;
    }
    
    try {
        const result = await api.addAttendeesBulk(attendees);
        
        // 결과 표시
        let resultHTML = `
            <div class="bulk-result-summary">
                <p>✅ 추가 성공: ${result.results.added}명</p>
        `;
        
        if (result.results.duplicates.length > 0) {
            resultHTML += `<p>⚠️ 중복: ${result.results.duplicates.length}명</p>`;
            resultHTML += '<ul class="error-list">';
            result.results.duplicates.forEach(dup => {
                resultHTML += `<li>${dup.data['고객명'] || dup.data['이메일']}: ${dup.error}</li>`;
            });
            resultHTML += '</ul>';
        }
        
        if (result.results.failed.length > 0) {
            resultHTML += `<p>❌ 실패: ${result.results.failed.length}명</p>`;
            resultHTML += '<ul class="error-list">';
            result.results.failed.forEach(fail => {
                resultHTML += `<li>${fail.data['고객명'] || '이름 없음'}: ${fail.error}</li>`;
            });
            resultHTML += '</ul>';
        }
        
        resultHTML += '</div>';
        
        document.getElementById('bulkAddResult').innerHTML = resultHTML;
        document.getElementById('bulkAddResult').style.display = 'block';
        
        if (result.results.added > 0) {
            showToast(`${result.results.added}명이 추가되었습니다`, 'success');
            
            // 목록 새로고침
            await loadAttendees();
            await loadStats();
            
            // 입력 필드 초기화
            textarea.value = '';
        }
    } catch (error) {
        showToast('일괄 추가 실패: ' + error.message, 'error');
    }
}

// QR 코드 표시
function displayQRCode(qrCode, name) {
    const qrModal = document.getElementById('qrModal');
    document.getElementById('qrModalTitle').textContent = `${name} - QR 코드`;
    document.getElementById('qrCode').innerHTML = `<img src="${qrCode}" alt="QR Code">`;
    window.currentQRCode = qrCode;
    qrModal.style.display = 'block';
}

// CSV 파일 선택 처리
let selectedCSVFile = null;
let parsedCSVData = null;

function handleCSVFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    selectedCSVFile = file;
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const text = e.target.result;
        parseCSVPreview(text);
    };
    
    reader.readAsText(file);
}

// CSV 미리보기 파싱
function parseCSVPreview(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
        showToast('CSV 파일에 데이터가 없습니다', 'error');
        return;
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const attendees = [];
    
    for (let i = 1; i < lines.length && i <= 6; i++) { // 처음 5개만 미리보기
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = parseCSVLine(line);
        const attendee = {};
        
        headers.forEach((header, index) => {
            attendee[header] = values[index] || '';
        });
        
        attendees.push(attendee);
    }
    
    parsedCSVData = { headers, total: lines.length - 1, preview: attendees };
    showCSVPreview();
}

// CSV 라인 파싱 (쉼표, 큰따옴표 처리)
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    
    return values;
}

// CSV 미리보기 표시
function showCSVPreview() {
    const previewDiv = document.getElementById('csvPreview');
    const contentDiv = document.getElementById('csvPreviewContent');
    
    let html = `
        <p>총 ${parsedCSVData.total}명의 데이터가 발견되었습니다.</p>
        <table class="preview-table">
            <thead>
                <tr>
    `;
    
    parsedCSVData.headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    
    html += `
                </tr>
            </thead>
            <tbody>
    `;
    
    parsedCSVData.preview.forEach(attendee => {
        html += '<tr>';
        parsedCSVData.headers.forEach(header => {
            html += `<td>${attendee[header] || ''}</td>`;
        });
        html += '</tr>';
    });
    
    html += `
            </tbody>
        </table>
        <p class="preview-note">※ 처음 5개 데이터만 표시됩니다</p>
    `;
    
    contentDiv.innerHTML = html;
    previewDiv.style.display = 'block';
}

// CSV 업로드 확인
async function confirmCSVUpload() {
    if (!selectedCSVFile) {
        showToast('파일을 선택해주세요', 'error');
        return;
    }
    
    try {
        // 파일 전체 읽기
        const reader = new FileReader();
        reader.onload = async function(e) {
            const text = e.target.result;
            const lines = text.trim().split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            const attendees = [];
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = parseCSVLine(line);
                const attendee = {};
                
                headers.forEach((header, index) => {
                    attendee[header] = values[index] || '';
                });
                
                attendees.push(attendee);
            }
            
            // 일괄 추가 API 호출
            const result = await api.addAttendeesBulk(attendees);
            
            if (result.results.added > 0) {
                showToast(`${result.results.added}명이 추가되었습니다`, 'success');
                await loadAttendees();
                await loadStats();
                closeAddAttendeeModal();
            }
            
            // 중복이나 실패가 있으면 결과 표시
            if (result.results.duplicates.length > 0 || result.results.failed.length > 0) {
                showCSVUploadResult(result.results);
            }
        };
        
        reader.readAsText(selectedCSVFile);
    } catch (error) {
        showToast('CSV 업로드 실패: ' + error.message, 'error');
    }
}

// CSV 업로드 결과 표시
function showCSVUploadResult(results) {
    let message = `추가: ${results.added}명`;
    
    if (results.duplicates.length > 0) {
        message += `\n중복: ${results.duplicates.length}명`;
    }
    
    if (results.failed.length > 0) {
        message += `\n실패: ${results.failed.length}명`;
    }
    
    alert(message);
}

// CSV 업로드 취소
function cancelCSVUpload() {
    selectedCSVFile = null;
    parsedCSVData = null;
    document.getElementById('csvAddFile').value = '';
    document.getElementById('csvPreview').style.display = 'none';
}

// 전역 스코프에 노출
window.toggleAttendeeCheckin = toggleAttendeeCheckin;
window.enableCellEdit = enableCellEdit;
window.handleEditKeyup = handleEditKeyup;
window.saveEdit = saveEdit;
window.deleteAttendee = deleteAttendee;
window.showAddAttendeeModal = showAddAttendeeModal;
window.closeAddAttendeeModal = closeAddAttendeeModal;
window.switchTab = switchTab;
window.handleAddAttendee = handleAddAttendee;
window.handleBulkAdd = handleBulkAdd;
window.handleCSVFileSelect = handleCSVFileSelect;
window.confirmCSVUpload = confirmCSVUpload;
window.cancelCSVUpload = cancelCSVUpload;

// 검색 기능
const searchHandler = debounce(function(e) {
    currentSearch = e.target.value;
    renderAttendees();
}, 300);

// 필터 변경
function handleFilterChange(filter) {
    currentFilter = filter;
    
    // 버튼 활성화 상태 업데이트
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });
    
    renderAttendees();
}

// CSV 업로드 처리
async function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const result = await api.uploadCSV(file);
        
        if (result.success) {
            showToast(result.message, 'success');
            // 데이터 다시 로드
            await loadAttendees();
            await loadStats();
        }
    } catch (error) {
        console.error('CSV 업로드 실패:', error);
        showToast('CSV 업로드에 실패했습니다.', 'error');
    }
    
    // 파일 입력 초기화
    event.target.value = '';
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', () => {
    console.log('참가자 관리 페이지 시작');
    
    // 검색 이벤트 리스너
    document.getElementById('searchBox').addEventListener('input', searchHandler);
    
    // 필터 버튼 이벤트 리스너
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => handleFilterChange(btn.dataset.filter));
    });
    
    // CSV 업로드 이벤트 리스너 제거 (모달 내에서만 처리)
    
    // 백엔드 초기화 완료 후 데이터 로드
    if (window.initializeBackends) {
        window.initializeBackends().then(success => {
            if (success) {
                loadStats();
                loadAttendees();
                
                // 5초마다 통계 업데이트
                setInterval(loadStats, 5000);
            }
        });
    } else {
        // fallback: 백엔드 초기화 대기
        setTimeout(() => {
            loadStats();
            loadAttendees();
            
            // 5초마다 통계 업데이트
            setInterval(loadStats, 5000);
        }, 1000);
    }
});

// QR 코드 관련 변수
let currentQRData = null;

// QR 코드 생성
async function generateQRCode(registrationNumber, name) {
    try {
        // API 호출
        const response = await fetch(getApiUrl(`/api/qr/generate/${registrationNumber}`), {
            method: 'GET'
        });

        if (!response.ok) {
            throw new Error('QR 코드 생성 실패');
        }

        const result = await response.json();
        currentQRData = result.qrCode;

        // 모달 제목 업데이트
        document.getElementById('qrModalTitle').textContent = `QR 코드 - ${name} (${registrationNumber})`;

        // QR 코드 표시
        const qrContainer = document.getElementById('qrCode');
        qrContainer.innerHTML = `<img src="${result.qrCode}" alt="QR Code" style="max-width: 300px;">`;

        // 모달 표시
        const modal = document.getElementById('qrModal');
        modal.style.display = 'block';

        // ESC 키로 닫기
        document.addEventListener('keydown', handleModalEsc);
        
        // 모달 외부 클릭으로 닫기
        modal.addEventListener('click', handleModalOutsideClick);
    } catch (error) {
        console.error('QR 코드 생성 실패:', error);
        showToast('QR 코드 생성에 실패했습니다.', 'error');
    }
}

// 모달 닫기
function closeQRModal() {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'none';
    
    // 이벤트 리스너 제거
    document.removeEventListener('keydown', handleModalEsc);
    modal.removeEventListener('click', handleModalOutsideClick);
}

// ESC 키 핸들러
function handleModalEsc(event) {
    if (event.key === 'Escape') {
        closeQRModal();
    }
}

// 모달 외부 클릭 핸들러
function handleModalOutsideClick(event) {
    const modal = document.getElementById('qrModal');
    if (event.target === modal) {
        closeQRModal();
    }
}

// QR 코드 다운로드
function downloadQR() {
    if (!currentQRData) return;

    // base64 데이터를 blob으로 변환
    const base64Data = currentQRData.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    
    // 다운로드 링크 생성
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    // 파일명 설정
    const modalTitle = document.getElementById('qrModalTitle').textContent;
    const fileName = modalTitle.replace('QR 코드 - ', 'QR_').replace(/[^a-zA-Z0-9가-힣_]/g, '_') + '.png';
    a.download = fileName;
    
    document.body.appendChild(a);
    a.click();
    
    // 정리
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// 전역 스코프에 함수들 노출
window.generateQRCode = generateQRCode;
window.closeQRModal = closeQRModal;
window.downloadQR = downloadQR;