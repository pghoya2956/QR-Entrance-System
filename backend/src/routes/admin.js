const express = require('express');
const router = express.Router();
const csvService = require('../services/csvService');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/attendees', async (req, res) => {
  try {
    const attendees = await csvService.readAttendees();
    res.json(attendees);
  } catch (error) {
    res.status(500).json({ error: '참석자 목록 조회 실패' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const attendees = await csvService.readAttendees();
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
    const attendees = await csvService.readAttendees();
    const resetAttendees = attendees.map(attendee => ({
      ...attendee,
      '체크인': 'false',
      '체크인시간': ''
    }));
    
    await csvService.writeAttendees(resetAttendees);
    res.json({ success: true, message: '모든 체크인 데이터가 초기화되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '초기화 실패' });
  }
});

// 체크인 상태 토글 API
router.put('/attendee/:registrationNumber/toggle-checkin', async (req, res) => {
  try {
    const { registrationNumber } = req.params;
    const attendees = await csvService.readAttendees();
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
    
    await csvService.writeAttendees(attendees);
    
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

// CSV 다운로드 API
router.get('/export-csv', async (req, res) => {
  try {
    const attendees = await csvService.readAttendees();
    const csvContent = await csvService.generateCSV(attendees);
    
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
    const attendees = await csvService.parseCSV(csvContent);
    
    if (!attendees || attendees.length === 0) {
      return res.status(400).json({ error: '유효한 데이터가 없습니다.' });
    }
    
    await csvService.writeAttendees(attendees);
    
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

module.exports = router;