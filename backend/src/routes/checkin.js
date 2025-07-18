const express = require('express');
const router = express.Router();
const qrService = require('../services/qrService');
// 전역 dataService 사용 (csvService 또는 dbService)
const dataService = global.dataService;

router.post('/verify', async (req, res) => {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({ error: 'QR 데이터가 필요합니다.' });
    }

    // QR 데이터에서 등록번호 추출
    let registrationNumber;
    
    // 형식 1: CHECKIN:REG001 또는 CHECKIN:STU001 등
    let match = qrData.match(/^CHECKIN:([A-Z0-9]+)$/);
    if (match) {
      registrationNumber = match[1];
    } else {
      // 형식 2: REG001:김철수 (등록번호:이름)
      match = qrData.match(/^([A-Z0-9]+):(.+)$/);
      if (match) {
        registrationNumber = match[1];
      } else {
        // 형식 3: 이름 번호 (이름과 4자리 숫자)
        match = qrData.match(/(\d{4})$/);
        if (match) {
          registrationNumber = match[1];
        } else {
          return res.status(401).json({ 
            error: '유효하지 않은 QR 코드입니다.',
            details: 'QR 코드 형식이 올바르지 않습니다.' 
          });
        }
      }
    }
    const attendee = await dataService.getAttendeeByRegistrationNumber(registrationNumber);
    
    if (!attendee) {
      return res.status(404).json({ error: '참석자를 찾을 수 없습니다.' });
    }

    if (attendee['체크인'] === 'true') {
      return res.status(409).json({ 
        error: '이미 체크인된 참석자입니다.',
        attendeeInfo: {
          name: attendee['고객명'],
          company: attendee['회사명'],
          registrationNumber: attendee['등록번호'],
          checkinTime: attendee['체크인시간']
        }
      });
    }

    const checkinTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const updatedAttendee = await dataService.updateAttendee(registrationNumber, {
      '체크인': 'true',
      '체크인시간': checkinTime
    });

    res.json({
      success: true,
      message: '체크인이 완료되었습니다.',
      attendeeInfo: {
        name: updatedAttendee['고객명'],
        company: updatedAttendee['회사명'],
        registrationNumber: updatedAttendee['등록번호'],
        checkinTime: updatedAttendee['체크인시간']
      }
    });
  } catch (error) {
    console.error('체크인 오류:', error);
    res.status(500).json({ error: '체크인 처리 중 오류가 발생했습니다.' });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { checkIns } = req.body;
    
    if (!Array.isArray(checkIns)) {
      return res.status(400).json({ error: '체크인 목록이 필요합니다.' });
    }

    const results = [];
    for (const checkIn of checkIns) {
      const { qrData, timestamp } = checkIn;
      let registrationNumber;
      
      // 형식 1: CHECKIN:REG001 또는 CHECKIN:STU001 등
      let match = qrData.match(/^CHECKIN:([A-Z0-9]+)$/);
      if (match) {
        registrationNumber = match[1];
      } else {
        // 형식 2: REG001:김철수 (등록번호:이름)
        match = qrData.match(/^([A-Z0-9]+):(.+)$/);
        if (match) {
          registrationNumber = match[1];
        } else {
          // 형식 3: 이름 번호 (이름과 4자리 숫자)
          match = qrData.match(/(\d{4})$/);
          if (match) {
            registrationNumber = match[1];
          }
        }
      }
      
      if (registrationNumber) {
        const updatedAttendee = await dataService.updateAttendee(registrationNumber, {
          '체크인': 'true',
          '체크인시간': timestamp || new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        });
        
        if (updatedAttendee) {
          results.push({
            registrationNumber,
            success: true,
            name: updatedAttendee['고객명']
          });
        }
      }
    }

    res.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: '배치 체크인 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;