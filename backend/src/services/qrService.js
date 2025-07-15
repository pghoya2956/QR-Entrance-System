const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

class QRService {
  async generateQRCode(attendeeData) {
    try {
      // QR 코드에는 등록번호만 저장
      const qrData = `CHECKIN:${attendeeData['등록번호']}`;

      const qrCodeData = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1
      });

      return {
        qrCode: qrCodeData,
        qrData: qrData,
        attendeeInfo: {
          registrationNumber: attendeeData['등록번호'],
          name: attendeeData['고객명'],
          email: attendeeData['이메일']
        }
      };
    } catch (error) {
      console.error('QR 코드 생성 오류:', error);
      throw error;
    }
  }

  verifyQRToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return {
        valid: true,
        data: decoded
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = new QRService();