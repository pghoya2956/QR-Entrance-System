const express = require('express');
const router = express.Router();
const qrService = require('../services/qrService');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const archiver = require('archiver');
// 전역 dataService 사용 (dataService 또는 dbService)
const dataService = global.dataService;

router.get('/attendees', async (req, res) => {
  try {
    const attendees = await dataService.readAttendees();
    res.json(attendees);
  } catch (error) {
    res.status(500).json({ error: '참석자 목록 조회 실패' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const attendees = await dataService.readAttendees();
    const total = attendees.length;
    const checkedIn = attendees.filter(a => a['체크인'] === 'true').length;
    const notCheckedIn = total - checkedIn;
    
    res.json({
      total,
      checkedIn,
      notCheckedIn,
      checkedInPercentage: total > 0 ? ((checkedIn / total) * 100).toFixed(1) : 0
    });
  } catch (error) {
    res.status(500).json({ error: '통계 조회 실패' });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const attendees = await dataService.readAttendees();
    const resetAttendees = attendees.map(attendee => ({
      ...attendee,
      '체크인': 'false',
      '체크인시간': ''
    }));
    
    await dataService.writeAttendees(resetAttendees);
    res.json({ success: true, message: '모든 체크인 데이터가 초기화되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '초기화 실패' });
  }
});

// 체크인 상태 토글 API
router.put('/attendee/:registrationNumber/toggle-checkin', async (req, res) => {
  try {
    const { registrationNumber } = req.params;
    const attendees = await dataService.readAttendees();
    const attendeeIndex = attendees.findIndex(a => a['등록번호'] === registrationNumber);
    
    if (attendeeIndex === -1) {
      return res.status(404).json({ error: '참석자를 찾을 수 없습니다.' });
    }
    
    const attendee = attendees[attendeeIndex];
    const newCheckedInStatus = attendee['체크인'] === 'true' ? 'false' : 'true';
    
    attendees[attendeeIndex] = {
      ...attendee,
      '체크인': newCheckedInStatus,
      '체크인시간': newCheckedInStatus === 'true' ? new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : ''
    };
    
    await dataService.writeAttendees(attendees);
    
    res.json({ 
      success: true, 
      attendee: attendees[attendeeIndex],
      message: newCheckedInStatus === 'true' ? '체크인 되었습니다.' : '체크인이 취소되었습니다.'
    });
  } catch (error) {
    console.error('체크인 토글 오류:', error);
    res.status(500).json({ error: '체크인 상태 변경 실패' });
  }
});

// 개별 참가자 수정 API
router.put('/attendees/:registrationNumber', async (req, res) => {
  try {
    const { registrationNumber } = req.params;
    const updates = req.body;
    
    const attendees = await dataService.readAttendees();
    const index = attendees.findIndex(a => a['등록번호'] === registrationNumber);
    
    if (index === -1) {
      return res.status(404).json({ error: '참가자를 찾을 수 없습니다' });
    }
    
    // 수정 불가 필드 보호
    delete updates['등록번호'];
    delete updates['체크인시간'];
    
    // 이메일 중복 체크 (본인 제외)
    if (updates['이메일']) {
      const duplicate = attendees.find((a, i) => 
        i !== index && a['이메일'] === updates['이메일']
      );
      if (duplicate) {
        return res.status(409).json({ error: '이미 사용중인 이메일입니다' });
      }
    }
    
    // 업데이트
    attendees[index] = { ...attendees[index], ...updates };
    await dataService.writeAttendees(attendees);
    
    res.json({ 
      success: true, 
      attendee: attendees[index],
      message: '정보가 수정되었습니다'
    });
  } catch (error) {
    console.error('참가자 수정 오류:', error);
    res.status(500).json({ error: '참가자 정보 수정 실패' });
  }
});

// 참가자 삭제 API
router.delete('/attendees/:registrationNumber', async (req, res) => {
  try {
    const { registrationNumber } = req.params;
    
    const attendees = await dataService.readAttendees();
    const initialLength = attendees.length;
    const filtered = attendees.filter(a => a['등록번호'] !== registrationNumber);
    
    if (filtered.length === initialLength) {
      return res.status(404).json({ error: '참가자를 찾을 수 없습니다' });
    }
    
    await dataService.writeAttendees(filtered);
    
    res.json({ 
      success: true, 
      message: '참가자가 삭제되었습니다',
      deletedCount: initialLength - filtered.length
    });
  } catch (error) {
    console.error('참가자 삭제 오류:', error);
    res.status(500).json({ error: '참가자 삭제 실패' });
  }
});

// 참가자 추가 API
router.post('/attendees', async (req, res) => {
  try {
    const attendeeData = req.body;
    
    // 등록번호 자동 생성 (없을 경우)
    if (!attendeeData['등록번호']) {
      attendeeData['등록번호'] = await dataService.generateRegistrationNumber();
    }
    
    // 기본값 설정
    attendeeData['체크인'] = attendeeData['체크인'] || 'false';
    attendeeData['체크인시간'] = attendeeData['체크인시간'] || '';
    
    // 필수 필드 검증
    const missing = dataService.validateRequired(attendeeData);
    if (missing.length > 0) {
      return res.status(400).json({ 
        error: '필수 필드가 누락되었습니다', 
        missing 
      });
    }
    
    // CSV에 추가
    const result = await dataService.addAttendee(attendeeData);
    
    // QR 생성
    const qrData = await qrService.generateQRCode(result);
    
    res.json({
      success: true,
      attendee: result,
      qrCode: qrData.qrCode,
      message: '참가자가 추가되었습니다'
    });
    
  } catch (error) {
    console.error('참가자 추가 오류:', error);
    res.status(error.message.includes('중복') ? 409 : 500).json({ 
      error: error.message 
    });
  }
});

// 일괄 참가자 추가 API
router.post('/attendees/bulk', async (req, res) => {
  try {
    const { attendees } = req.body;
    
    console.log('일괄 추가 요청:', {
      count: attendees?.length,
      firstItem: attendees?.[0]
    });
    
    if (!Array.isArray(attendees)) {
      return res.status(400).json({ error: '참가자 목록은 배열 형식이어야 합니다' });
    }
    
    const results = {
      added: 0,
      failed: [],
      duplicates: []
    };
    
    for (const attendeeData of attendees) {
      try {
        // 필드 매핑 디버깅
        console.log('처리 중인 참가자:', attendeeData);
        
        // 등록번호 자동 생성
        if (!attendeeData['등록번호']) {
          attendeeData['등록번호'] = await dataService.generateRegistrationNumber();
        }
        
        // 기본값 설정
        attendeeData['체크인'] = 'false';
        attendeeData['체크인시간'] = '';
        
        // 필수 필드 검증
        const missing = dataService.validateRequired(attendeeData);
        if (missing.length > 0) {
          throw new Error(`필수 필드 누락: ${missing.join(', ')}`);
        }
        
        await dataService.addAttendee(attendeeData);
        results.added++;
        console.log(`✅ 추가 성공: ${attendeeData['고객명']} (${attendeeData['등록번호']})`);
        
      } catch (error) {
        console.error(`❌ 추가 실패: ${error.message}`, attendeeData);
        if (error.message.includes('중복')) {
          results.duplicates.push({
            data: attendeeData,
            error: error.message
          });
        } else {
          results.failed.push({
            data: attendeeData,
            error: error.message
          });
        }
      }
    }
    
    res.json({
      success: true,
      results,
      message: `${results.added}명이 추가되었습니다`
    });
    
  } catch (error) {
    console.error('일괄 추가 오류:', error);
    res.status(500).json({ error: '일괄 추가 처리 실패' });
  }
});

// CSV 다운로드 API
router.get('/export-csv', async (req, res) => {
  try {
    const attendees = await dataService.readAttendees();
    const csvContent = await dataService.generateCSV(attendees);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="attendees.csv"');
    res.send('\ufeff' + csvContent); // BOM 추가 for UTF-8
  } catch (error) {
    console.error('CSV 다운로드 오류:', error);
    res.status(500).json({ error: 'CSV 다운로드 실패' });
  }
});

// CSV 업로드 API
router.post('/import-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV 파일이 없습니다.' });
    }
    
    const csvContent = req.file.buffer.toString('utf-8');
    const attendees = await dataService.parseCSV(csvContent);
    
    if (!attendees || attendees.length === 0) {
      return res.status(400).json({ error: '유효한 데이터가 없습니다.' });
    }
    
    await dataService.writeAttendees(attendees);
    
    res.json({ 
      success: true, 
      imported: attendees.length,
      message: `${attendees.length}명의 참석자 데이터가 업로드되었습니다.`
    });
  } catch (error) {
    console.error('CSV 업로드 오류:', error);
    res.status(500).json({ error: 'CSV 업로드 실패' });
  }
});

// 일괄 삭제 API
router.post('/attendees/bulk-delete', async (req, res) => {
  try {
    const { registrationNumbers } = req.body;
    
    if (!Array.isArray(registrationNumbers) || registrationNumbers.length === 0) {
      return res.status(400).json({ error: '삭제할 참가자를 선택해주세요' });
    }
    
    const attendees = await dataService.readAttendees();
    const initialLength = attendees.length;
    const filtered = attendees.filter(a => !registrationNumbers.includes(a['등록번호']));
    const deletedCount = initialLength - filtered.length;
    
    if (deletedCount === 0) {
      return res.status(404).json({ error: '삭제할 참가자를 찾을 수 없습니다' });
    }
    
    await dataService.writeAttendees(filtered);
    
    res.json({ 
      success: true, 
      deletedCount,
      message: `${deletedCount}명의 참가자가 삭제되었습니다`
    });
  } catch (error) {
    console.error('일괄 삭제 오류:', error);
    res.status(500).json({ error: '일괄 삭제 실패' });
  }
});

// 일괄 체크인 API
router.post('/attendees/bulk-checkin', async (req, res) => {
  try {
    const { registrationNumbers, checkinStatus } = req.body;
    
    if (!Array.isArray(registrationNumbers) || registrationNumbers.length === 0) {
      return res.status(400).json({ error: '체크인할 참가자를 선택해주세요' });
    }
    
    const attendees = await dataService.readAttendees();
    let updatedCount = 0;
    const currentTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    
    const updatedAttendees = attendees.map(attendee => {
      if (registrationNumbers.includes(attendee['등록번호'])) {
        updatedCount++;
        return {
          ...attendee,
          '체크인': String(checkinStatus),
          '체크인시간': checkinStatus ? currentTime : ''
        };
      }
      return attendee;
    });
    
    if (updatedCount === 0) {
      return res.status(404).json({ error: '업데이트할 참가자를 찾을 수 없습니다' });
    }
    
    await dataService.writeAttendees(updatedAttendees);
    
    res.json({ 
      success: true, 
      updatedCount,
      message: checkinStatus 
        ? `${updatedCount}명이 체크인되었습니다`
        : `${updatedCount}명의 체크인이 취소되었습니다`
    });
  } catch (error) {
    console.error('일괄 체크인 오류:', error);
    res.status(500).json({ error: '일괄 체크인 실패' });
  }
});

// 백업 관련 API (DB 모드일 때만)
router.get('/backups', async (req, res) => {
  try {
    if (!process.env.USE_DATABASE || process.env.USE_DATABASE === 'false') {
      return res.status(400).json({ error: '백업은 데이터베이스 모드에서만 사용 가능합니다.' });
    }
    
    const backups = await global.backupService.listBackups();
    
    res.json({
      backups,
      status: global.backupService.getStatus()
    });
  } catch (error) {
    console.error('백업 목록 조회 오류:', error);
    res.status(500).json({ error: '백업 목록 조회 실패' });
  }
});

router.post('/backup', async (req, res) => {
  try {
    if (!process.env.USE_DATABASE || process.env.USE_DATABASE === 'false') {
      return res.status(400).json({ error: '백업은 데이터베이스 모드에서만 사용 가능합니다.' });
    }
    
    const result = await global.backupService.createBackup();
    
    res.json({
      success: true,
      backup: result,
      message: '백업이 성공적으로 생성되었습니다.'
    });
  } catch (error) {
    console.error('백업 생성 오류:', error);
    res.status(500).json({ error: '백업 생성 실패' });
  }
});

// QR 일괄 다운로드 API
router.post('/qr/download-zip', async (req, res) => {
  try {
    const { registrationNumbers } = req.body;
    
    if (!Array.isArray(registrationNumbers) || registrationNumbers.length === 0) {
      return res.status(400).json({ error: 'QR을 생성할 참가자를 선택해주세요' });
    }
    
    const attendees = await dataService.readAttendees();
    const selectedAttendees = attendees.filter(a => 
      registrationNumbers.includes(a['등록번호'])
    );
    
    if (selectedAttendees.length === 0) {
      return res.status(404).json({ error: '참가자를 찾을 수 없습니다' });
    }
    
    // ZIP 파일 생성
    const archive = archiver('zip', {
      zlib: { level: 9 } // 최고 압축률
    });
    
    // 파일명 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `qr_codes_${timestamp}.zip`;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    archive.pipe(res);
    
    // QR 코드 생성 및 ZIP에 추가
    for (const attendee of selectedAttendees) {
      const qrData = await qrService.generateQRCode(attendee);
      const buffer = Buffer.from(qrData.qrImage.split(',')[1], 'base64');
      const safeFilename = `${attendee['등록번호']}_${attendee['고객명'].replace(/[/\\?%*:|"<>]/g, '')}.png`;
      
      archive.append(buffer, { name: safeFilename });
    }
    
    await archive.finalize();
    
  } catch (error) {
    console.error('QR ZIP 다운로드 오류:', error);
    res.status(500).json({ error: 'QR 일괄 다운로드 실패' });
  }
});

module.exports = router;