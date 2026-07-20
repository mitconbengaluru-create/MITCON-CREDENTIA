import ExcelJS from 'exceljs';
import * as exportUtil from '../utils/export.util.js';

export class ExportServiceError extends Error {
  constructor(message, code = 'EXPORT_ERROR') {
    super(message);
    this.name = 'ExportServiceError';
    this.code = code;
  }
}

export class ExportService {
  /**
   * Main export dispatcher. Processes datasets and creates the final file payload.
   * 
   * @async
   * @method generateReportExport
   * @param {Object} report - DB Report instance
   * @param {Array} dataset - Pre-fetched dataset array
   * @returns {Promise<Object>} Output details: buffer, fileName, format, mimeType, fileSize, fileHash
   */
  async generateReportExport(report, dataset) {
    if (!report) {
      throw new ExportServiceError('Report definition is required', 'INVALID_REPORT');
    }
    const cleanDataset = exportUtil.maskSensitiveFields(dataset || []);

    let buffer;
    let mimeType;
    let extension;

    if (report.format === 'EXCEL') {
      buffer = await this.generateExcel(report, cleanDataset);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    } else if (report.format === 'CSV') {
      buffer = await this.generateCSV(report, cleanDataset);
      mimeType = 'text/csv';
      extension = 'csv';
    } else {
      throw new ExportServiceError(`Unsupported format: ${report.format}`, 'INVALID_FORMAT');
    }

    const fileSize = buffer.length;
    const fileHash = exportUtil.calculateSha256(buffer);
    const fileName = `${report.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${report.refNumber}.${extension}`;

    return {
      buffer,
      fileName,
      format: report.format,
      mimeType,
      fileSize,
      fileHash,
      generatedAt: new Date(),
    };
  }

  /**
   * Generates Excel workbook with multiple sheets based on report types.
   */
  async generateExcel(report, dataset) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MITCON Credentia Ledger';
    workbook.created = new Date();

    // 1. Add Metadata Sheet
    const metaSheet = workbook.addWorksheet('Metadata');
    metaSheet.columns = [
      { header: 'Property', key: 'property', width: 25 },
      { header: 'Value', key: 'value', width: 50 },
    ];
    metaSheet.addRows([
      { property: 'Report Reference', value: report.refNumber },
      { property: 'Report Name', value: report.name },
      { property: 'Report Type', value: report.type },
      { property: 'Format', value: report.format },
      { property: 'Status', value: report.status },
      { property: 'Requested By', value: report.userSnapshot?.email || 'System' },
      { property: 'Department Snapshot', value: report.departmentSnapshot || 'N/A' },
      { property: 'Generated At', value: exportUtil.formatDate(new Date()) },
    ]);
    this.styleHeaderRow(metaSheet);

    // 2. Report Type specific sheets
    if (report.type === 'DOCUMENT_ACTIVITY' || report.type === 'COMPLIANCE_REPORT') {
      await this.buildDocumentExcelSheets(workbook, dataset);
    } else if (report.type === 'CHECKOUT_REPORT' || report.type === 'RETURN_REPORT') {
      await this.buildCheckoutExcelSheets(workbook, dataset);
    } else if (report.type === 'APPROVAL_REPORT') {
      await this.buildApprovalExcelSheets(workbook, dataset);
    } else if (report.type === 'SIGNATURE_REPORT') {
      await this.buildSignatureExcelSheets(workbook, dataset);
    } else if (report.type === 'AUDIT_REPORT' || report.type === 'SECURITY_REPORT' || report.type === 'SYSTEM_REPORT') {
      await this.buildAuditExcelSheets(workbook, dataset);
    } else {
      // Fallback simple sheet
      const recordsSheet = workbook.addWorksheet('Records');
      if (dataset.length > 0) {
        const keys = Object.keys(dataset[0]);
        recordsSheet.columns = keys.map(k => ({ header: k.toUpperCase(), key: k, width: 20 }));
        dataset.forEach(row => {
          const sanitizedRow = {};
          keys.forEach(k => {
            sanitizedRow[k] = exportUtil.sanitizeCellValue(row[k]);
          });
          recordsSheet.addRow(sanitizedRow);
        });
      } else {
        recordsSheet.addRow(['No records found matching filters.']);
      }
      this.styleHeaderRow(recordsSheet);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generates flat CSV file formatted and escaped properly.
   */
  async generateCSV(report, dataset) {
    if (dataset.length === 0) {
      return Buffer.from('No records found matching filters.\n');
    }

    const keys = Object.keys(dataset[0]);
    const headerLine = keys.map(this.escapeCSVCell).join(',');
    
    const rowLines = dataset.map(row => {
      return keys.map(key => {
        const val = exportUtil.sanitizeCellValue(row[key]);
        return this.escapeCSVCell(val);
      }).join(',');
    });

    const csvContent = '\ufeff' + [headerLine, ...rowLines].join('\n') + '\n';
    return Buffer.from(csvContent, 'utf8');
  }

  escapeCSVCell(value) {
    if (value === null || value === undefined) return '';
    let stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    // Check if cell needs surrounding double quotes
    if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
      stringVal = '"' + stringVal.replace(/"/g, '""') + '"';
    }
    return stringVal;
  }

  styleHeaderRow(worksheet) {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A365D' }, // Navy blue color
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  autoSizeColumns(worksheet) {
    worksheet.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const value = cell.value ? String(cell.value) : '';
        if (value.length > maxLen) maxLen = value.length;
      });
      column.width = Math.max(maxLen + 4, 12);
    });
  }

  // ==========================================
  // Report Sheet Builders
  // ==========================================

  async buildDocumentExcelSheets(workbook, dataset) {
    // 1. Overview Sheet
    const overviewSheet = workbook.addWorksheet('Overview');
    overviewSheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 25 },
    ];
    const totalDocs = dataset.length;
    const activeDocs = dataset.filter(d => d.status === 'ACTIVE').length;
    const archivedDocs = dataset.filter(d => d.status === 'ARCHIVED').length;
    
    const classifications = {};
    dataset.forEach(d => {
      if (d.classification) {
        classifications[d.classification] = (classifications[d.classification] || 0) + 1;
      }
    });

    overviewSheet.addRow({ metric: 'Total Documents', value: totalDocs });
    overviewSheet.addRow({ metric: 'Active Documents', value: activeDocs });
    overviewSheet.addRow({ metric: 'Archived Documents', value: archivedDocs });
    Object.keys(classifications).forEach(cl => {
      overviewSheet.addRow({ metric: `Classification: ${cl}`, value: classifications[cl] });
    });
    this.styleHeaderRow(overviewSheet);

    // 2. Records Sheet
    const recordsSheet = workbook.addWorksheet('Records');
    recordsSheet.columns = [
      { header: 'Document Name', key: 'name', width: 30 },
      { header: 'Owner', key: 'owner', width: 25 },
      { header: 'Classification', key: 'classification', width: 15 },
      { header: 'Version', key: 'version', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created Date', key: 'createdAt', width: 25 },
      { header: 'Last Updated', key: 'updatedAt', width: 25 },
    ];
    dataset.forEach(row => {
      recordsSheet.addRow({
        name: exportUtil.sanitizeCellValue(row.name),
        owner: exportUtil.sanitizeCellValue(row.ownerSnapshot?.email || row.ownerEmail || 'System'),
        classification: row.classification,
        version: row.version,
        status: row.status,
        createdAt: exportUtil.formatDate(row.createdAt),
        updatedAt: exportUtil.formatDate(row.updatedAt),
      });
    });
    this.styleHeaderRow(recordsSheet);
    this.autoSizeColumns(recordsSheet);

    // 3. Activity Sheet
    const activitySheet = workbook.addWorksheet('Activity');
    activitySheet.columns = [
      { header: 'Document ID', key: 'documentId', width: 36 },
      { header: 'Activity Type', key: 'activity', width: 20 },
      { header: 'Performed By', key: 'performedBy', width: 25 },
      { header: 'Timestamp', key: 'timestamp', width: 25 },
    ];
    // Gather uploads and logs if nested in metadata or flat mapping
    dataset.forEach(doc => {
      activitySheet.addRow({
        documentId: doc.id,
        activity: 'UPLOAD',
        performedBy: doc.ownerSnapshot?.email || 'System',
        timestamp: exportUtil.formatDate(doc.createdAt),
      });
    });
    this.styleHeaderRow(activitySheet);
  }

  async buildCheckoutExcelSheets(workbook, dataset) {
    const recordsSheet = workbook.addWorksheet('Records');
    recordsSheet.columns = [
      { header: 'Checkout ID', key: 'id', width: 36 },
      { header: 'Document', key: 'document', width: 30 },
      { header: 'Requested User', key: 'user', width: 25 },
      { header: 'Approval Status', key: 'approvalStatus', width: 15 },
      { header: 'Checkout Date', key: 'checkoutDate', width: 25 },
      { header: 'Expected Return', key: 'expectedReturn', width: 25 },
      { header: 'Actual Return', key: 'actualReturn', width: 25 },
      { header: 'Delay Days', key: 'delay', width: 12 },
      { header: 'Current Status', key: 'status', width: 15 },
    ];
    dataset.forEach(row => {
      let delay = 0;
      if (row.expectedReturn && !row.actualReturn && new Date(row.expectedReturn) < new Date()) {
        delay = Math.floor((new Date() - new Date(row.expectedReturn)) / (1000 * 3600 * 24));
      }
      recordsSheet.addRow({
        id: row.id,
        document: exportUtil.sanitizeCellValue(row.documentSnapshot?.name || row.documentId),
        user: exportUtil.sanitizeCellValue(row.userSnapshot?.email || row.userId),
        approvalStatus: row.approvalStatus || 'APPROVED',
        checkoutDate: exportUtil.formatDate(row.checkoutDate || row.createdAt),
        expectedReturn: exportUtil.formatDate(row.expectedReturn),
        actualReturn: exportUtil.formatDate(row.actualReturn),
        delay: delay > 0 ? delay : 0,
        status: row.status,
      });
    });
    this.styleHeaderRow(recordsSheet);
    this.autoSizeColumns(recordsSheet);
  }

  async buildApprovalExcelSheets(workbook, dataset) {
    const recordsSheet = workbook.addWorksheet('Records');
    recordsSheet.columns = [
      { header: 'Approval Reference', key: 'ref', width: 20 },
      { header: 'Request Type', key: 'type', width: 20 },
      { header: 'Requested User', key: 'user', width: 25 },
      { header: 'Approver', key: 'approver', width: 25 },
      { header: 'Current Step', key: 'step', width: 15 },
      { header: 'Decision', key: 'decision', width: 15 },
      { header: 'Processing Time', key: 'time', width: 15 },
    ];
    dataset.forEach(row => {
      recordsSheet.addRow({
        ref: row.refNumber || row.id,
        type: row.type || 'DOCUMENT_RELEASE',
        user: exportUtil.sanitizeCellValue(row.requesterSnapshot?.email || row.requesterId),
        approver: exportUtil.sanitizeCellValue(row.approverSnapshot?.email || 'Pending'),
        step: row.currentStep || 1,
        decision: row.status,
        time: row.processingTime ? `${row.processingTime}ms` : 'N/A',
      });
    });
    this.styleHeaderRow(recordsSheet);
    this.autoSizeColumns(recordsSheet);
  }

  async buildSignatureExcelSheets(workbook, dataset) {
    const recordsSheet = workbook.addWorksheet('Records');
    recordsSheet.columns = [
      { header: 'Signature ID', key: 'id', width: 36 },
      { header: 'Signer', key: 'signer', width: 25 },
      { header: 'Reference Type', key: 'refType', width: 20 },
      { header: 'Verification Status', key: 'verification', width: 20 },
      { header: 'Binding Status', key: 'binding', width: 15 },
      { header: 'Created Date', key: 'createdAt', width: 25 },
    ];
    dataset.forEach(row => {
      recordsSheet.addRow({
        id: row.id,
        signer: exportUtil.sanitizeCellValue(row.userSnapshot?.email || row.userId),
        refType: row.referenceType,
        verification: row.verificationStatus || 'VERIFIED',
        binding: row.bindingStatus || 'ACTIVE',
        createdAt: exportUtil.formatDate(row.createdAt),
      });
    });
    this.styleHeaderRow(recordsSheet);
    this.autoSizeColumns(recordsSheet);
  }

  async buildAuditExcelSheets(workbook, dataset) {
    // 1. Events Sheet
    const eventsSheet = workbook.addWorksheet('Events');
    eventsSheet.columns = [
      { header: 'Event ID', key: 'id', width: 36 },
      { header: 'User', key: 'user', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Action', key: 'action', width: 15 },
      { header: 'Result', key: 'result', width: 15 },
      { header: 'Timestamp', key: 'timestamp', width: 25 },
    ];
    dataset.forEach(row => {
      eventsSheet.addRow({
        id: row.id,
        user: exportUtil.sanitizeCellValue(row.userSnapshot || row.userId || 'System'),
        category: row.category,
        action: row.action,
        result: row.result,
        timestamp: exportUtil.formatDate(row.createdAt),
      });
    });
    this.styleHeaderRow(eventsSheet);
    this.autoSizeColumns(eventsSheet);

    // 2. Security Sheet
    const securitySheet = workbook.addWorksheet('Security');
    securitySheet.columns = [
      { header: 'Event ID', key: 'id', width: 36 },
      { header: 'Failed Events / Denials', key: 'description', width: 40 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'IP Address', key: 'ip', width: 15 },
      { header: 'Timestamp', key: 'timestamp', width: 25 },
    ];
    const securityEvents = dataset.filter(d => d.category === 'SECURITY' || d.result === 'FAILED' || d.result === 'DENIED');
    securityEvents.forEach(row => {
      securitySheet.addRow({
        id: row.id,
        description: exportUtil.sanitizeCellValue(row.description || `Action ${row.action} yielded ${row.result}`),
        category: row.category,
        ip: row.ipAddress || 'N/A',
        timestamp: exportUtil.formatDate(row.createdAt),
      });
    });
    this.styleHeaderRow(securitySheet);
    this.autoSizeColumns(securitySheet);

    // 3. Changes Sheet
    const changesSheet = workbook.addWorksheet('Changes');
    changesSheet.columns = [
      { header: 'Event ID', key: 'id', width: 36 },
      { header: 'Previous State', key: 'prev', width: 40 },
      { header: 'New State', key: 'next', width: 40 },
    ];
    const changeEvents = dataset.filter(d => d.previousState || d.newState);
    changeEvents.forEach(row => {
      changesSheet.addRow({
        id: row.id,
        prev: typeof row.previousState === 'object' ? JSON.stringify(row.previousState) : String(row.previousState || ''),
        next: typeof row.newState === 'object' ? JSON.stringify(row.newState) : String(row.newState || ''),
      });
    });
    this.styleHeaderRow(changesSheet);
    this.autoSizeColumns(changesSheet);
  }

  // ==========================================
  // Backward-Compatible API Wrappers
  // ==========================================
  async generateComplianceExport(report, dataset) {
    return this.generateReportExport(report, dataset);
  }

  async generateAuditExport(report, dataset) {
    return this.generateReportExport(report, dataset);
  }

  async generateSecurityExport(report, dataset) {
    return this.generateReportExport(report, dataset);
  }
}
