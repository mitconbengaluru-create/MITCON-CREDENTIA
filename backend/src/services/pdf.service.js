import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import { drawPageHeader, drawPageFooter, drawTable } from '../utils/pdf.util.js';

export class PDFService {
  /**
   * Generates a PDF buffer from the provided report meta and compiled dataset.
   * 
   * @async
   * @method generateReportPDF
   * @param {Object} report - Report request DB snapshot record
   * @param {Array<Object>} dataset - List of data records collected
   * @returns {Promise<{buffer: Buffer, fileName: string, fileSize: number, fileHash: string}>} File details
   */
  async generateReportPDF(report, dataset) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
          const fileName = `report_${report.refNumber}_${Date.now()}.pdf`;
          
          resolve({
            buffer,
            fileName,
            fileSize: buffer.length,
            fileHash,
          });
        });
        doc.on('error', err => reject(err));

        // Draw cover details & parameters summary box
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E3A8A')
          .text(report.name, 50, 70);
        doc.moveDown(0.2);
        
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#4B5563')
          .text(report.description || 'No description provided.', { width: 495 });
        doc.moveDown(1);

        // Parameters table summary box
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E3A8A').text('Report Generation Context:');
        doc.moveDown(0.3);
        
        const contextY = doc.y;
        doc.rect(50, contextY, 495, 75).fill('#F3F4F6');
        
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1F2937');
        doc.text('Reference No:', 60, contextY + 10);
        doc.font('Helvetica').text(report.refNumber, 150, contextY + 10);

        doc.font('Helvetica-Bold').text('Report Type:', 60, contextY + 25);
        doc.font('Helvetica').text(report.type, 150, contextY + 25);

        doc.font('Helvetica-Bold').text('Requested By:', 60, contextY + 40);
        const email = report.userSnapshot && typeof report.userSnapshot === 'object' 
          ? report.userSnapshot.email 
          : 'System';
        doc.font('Helvetica').text(email, 150, contextY + 40);

        doc.font('Helvetica-Bold').text('Generated Date:', 60, contextY + 55);
        doc.font('Helvetica').text(new Date().toUTCString(), 150, contextY + 55);

        doc.font('Helvetica-Bold').text('Filters Applied:', 280, contextY + 10);
        const filterText = Object.keys(report.filters || {})
          .map(k => `${k}: ${report.filters[k]}`)
          .join(', ') || 'None';
        doc.font('Helvetica').text(filterText, 360, contextY + 10, { width: 175, height: 50 });

        doc.y = contextY + 85;
        doc.moveDown(1);

        // Content Section Header
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1E3A8A').text('Report Data Items Ledger:');
        doc.moveDown(0.5);

        if (!dataset || dataset.length === 0) {
          doc.fontSize(9).font('Helvetica-Oblique').fillColor('#9CA3AF')
            .text('No matching history log items were located in database queries for this reporting scope.');
        } else {
          // Draw content grid table based on Report Type
          this._drawDatasetTable(doc, report.type, dataset);
        }

        // Finalize: Switch pages to overlay header/footers on all pages
        const range = doc.bufferedPageRange();
        const totalPages = range.count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          drawPageHeader(doc, report.name, report.refNumber, email);
          drawPageFooter(doc, i + 1, totalPages);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Routes table drawing parameters based on report type.
   * @private
   */
  _drawDatasetTable(doc, type, dataset) {
    if (type === 'DOCUMENT_ACTIVITY') {
      const headers = ['Document Name', 'Owner', 'Classification', 'Status', 'Version', 'Uploaded Date'];
      const rows = dataset.map(d => [
        d.name,
        d.owner?.email || d.ownerId || 'System',
        d.classification,
        d.status,
        d.version,
        d.createdAt ? new Date(d.createdAt).toISOString().split('T')[0] : 'N/A'
      ]);
      drawTable(doc, headers, rows, { alternate: true, columnWidths: [120, 110, 80, 75, 45, 65] });
    }
    
    else if (type === 'CHECKOUT_REPORT' || type === 'RETURN_REPORT') {
      const headers = ['Doc Snapshot', 'Requester', 'Department', 'Status', 'Expected Return', 'Returned'];
      const rows = dataset.map(c => [
        c.documentNameSnapshot,
        c.employeeName || 'N/A',
        c.department || 'N/A',
        c.status,
        c.expectedReturnDate ? new Date(c.expectedReturnDate).toISOString().split('T')[0] : 'Indefinite',
        c.returnedDate ? new Date(c.returnedDate).toISOString().split('T')[0] : 'Pending'
      ]);
      drawTable(doc, headers, rows, { alternate: true, columnWidths: [130, 90, 85, 75, 80, 80] });
    }
    
    else if (type === 'APPROVAL_REPORT') {
      const headers = ['Approval Reference', 'Requester', 'Priority', 'Status', 'Level', 'Requested Date'];
      const rows = dataset.map(a => [
        a.id.substring(0, 8).toUpperCase(),
        a.requesterName || 'N/A',
        a.priority,
        a.status,
        a.approvalLevel || '1',
        a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : 'N/A'
      ]);
      drawTable(doc, headers, rows, { alternate: true, columnWidths: [110, 100, 70, 80, 50, 85] });
    }
    
    else if (type === 'SIGNATURE_REPORT') {
      const headers = ['Reference No', 'Type', 'Status', 'Verifier', 'Verification Status', 'Signed At'];
      const rows = dataset.map(s => [
        s.signatureRefNumber,
        s.signatureType,
        s.status,
        s.verifiedBy || 'Pending',
        s.verificationStatus || 'UNVERIFIED',
        s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : 'N/A'
      ]);
      drawTable(doc, headers, rows, { alternate: true, columnWidths: [110, 80, 80, 80, 110, 85] });
    }
    
    else if (type === 'AUDIT_REPORT' || type === 'SECURITY_REPORT' || type === 'COMPLIANCE_REPORT' || type === 'SYSTEM_REPORT') {
      const headers = ['Event Ref', 'Category', 'Action', 'Result', 'Actor Snapshot', 'Timestamp'];
      const rows = dataset.map(a => {
        let actor = 'System';
        if (a.userSnapshot) {
          actor = typeof a.userSnapshot === 'string' 
            ? a.userSnapshot 
            : (a.userSnapshot.email || 'Actor');
        }
        return [
          a.eventRef,
          a.category,
          a.action,
          a.result,
          actor,
          a.createdAt ? new Date(a.createdAt).toISOString().substring(0, 19).replace('T', ' ') : 'N/A'
        ];
      });
      drawTable(doc, headers, rows, { alternate: true, columnWidths: [100, 70, 70, 65, 110, 80] });
    }
    
    else if (type === 'USER_ACTIVITY') {
      const headers = ['Event Reference', 'Action', 'Event Type', 'IP Address', 'Result', 'Timestamp'];
      const rows = dataset.map(u => [
        u.eventRef,
        u.action,
        u.eventType,
        u.ipAddress || 'Internal',
        u.result,
        u.createdAt ? new Date(u.createdAt).toISOString().substring(0, 19).replace('T', ' ') : 'N/A'
      ]);
      drawTable(doc, headers, rows, { alternate: true, columnWidths: [110, 70, 110, 80, 60, 65] });
    }
  }
}

export default PDFService;
