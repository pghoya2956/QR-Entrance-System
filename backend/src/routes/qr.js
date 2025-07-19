const express = require('express');
const router = express.Router();
const qrService = require('../services/qrService');
// 전역 dataService 사용 (csvService 또는 dbService)
const dataService = global.dataService;

router.get('/generate/:registrationNumber', async (req, res) => {
  try {
    const { registrationNumber } = req.params;
    const attendee = await dataService.getAttendeeByRegistrationNumber(registrationNumber, req.eventId);
    
    if (!attendee) {
      return res.status(404).json({ error: '참석자를 찾을 수 없습니다.' });
    }

    const qrData = await qrService.generateQRCode(attendee);
    res.json(qrData);
  } catch (error) {
    res.status(500).json({ error: 'QR 코드 생성 실패' });
  }
});

router.get('/generate-all', async (req, res) => {
  try {
    const attendees = await dataService.readAttendees(req.eventId);
    const qrCodes = [];

    for (const attendee of attendees) {
      const qrData = await qrService.generateQRCode(attendee);
      qrCodes.push(qrData);
    }

    res.json({ count: qrCodes.length, qrCodes });
  } catch (error) {
    res.status(500).json({ error: '전체 QR 코드 생성 실패' });
  }
});

module.exports = router;