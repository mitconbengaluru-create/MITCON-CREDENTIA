import { reportQueue } from '../jobs/index.js';
import { StorageService } from './storage/storage.service.js';
import { ReportRepository } from '../repositories/report.repository.js';
import { DocumentRepository } from '../repositories/documents.repository.js';
import { CheckoutRepository } from '../repositories/checkout.repository.js';
import { ApprovalRepository } from '../repositories/approval.repository.js';
import { SignatureRepository } from '../repositories/signature.repository.js';
import { AuditRepository } from '../repositories/audit.repository.js';
import reportUtil from '../utils/report.util.js';

/**
 * Standardized service layer error class for Report Domain operations.
 */
export class ReportServiceError extends Error {
  constructor(message, code = 'SERVICE_ERROR') {
    super(message);
    this.name = 'ReportServiceError';
    this.code = code;
  }
}

export class ReportService {
  constructor() {
    this.reportRepository = new ReportRepository();
    this.documentRepository = new DocumentRepository();
    this.checkoutRepository = new CheckoutRepository();
    this.approvalRepository = new ApprovalRepository();
    this.signatureRepository = new SignatureRepository();
    this.auditRepository = new AuditRepository();
  }

  // =========================================================================
  // Backward-Compatible API Wrappers
  // =========================================================================

  /**
   * Legacy wrapper to request report generation.
   */
  async requestReport(reportType, format, filters = {}, user) {
    const payload = {
      type: reportType === 'COMPLETE' ? 'AUDIT_REPORT' : reportType,
      format: format.toUpperCase(),
      filters,
    };
    const result = await this.createReport(payload, user);
    return {
      reportId: result.id,
      status: 'PENDING',
      reportType,
      format,
      requestedBy: user.email,
      createdAt: result.createdAt,
    };
  }

  /**
   * Legacy wrapper to retrieve report status.
   */
  async getReportStatus(reportId) {
    // If Redis is offline/Mock queue is used, handle gracefully
    if (reportQueue.constructor.name === 'MockQueue') {
      const report = await this.reportRepository.getReportById(reportId);
      if (report && report.status === 'COMPLETED') {
        let downloadUrl = null;
        if (report.filePath) {
          const data = await StorageService.generateDownloadUrl('documents', report.filePath, 900);
          downloadUrl = data.signedUrl;
        }
        return {
          reportId,
          status: 'COMPLETED',
          fileRef: report.filePath,
          downloadUrl,
          finishedAt: report.completedAt,
        };
      }
    }

    const report = await this.reportRepository.getReportById(reportId);
    if (!report) {
      return {
        reportId,
        status: 'FAILED',
        error: 'Job details not found.',
      };
    }

    let downloadUrl = null;
    if (report.status === 'COMPLETED' && report.filePath) {
      const data = await StorageService.generateDownloadUrl('documents', report.filePath, 900);
      downloadUrl = data.signedUrl;
    }

    return {
      reportId,
      status: report.status,
      fileRef: report.filePath,
      downloadUrl,
      finishedAt: report.completedAt,
    };
  }

  // =========================================================================
  // Report Lifecycle Workflows
  // =========================================================================

  /**
   * Request and initialize a new report request.
   * Scopes report details and filters based on user role permission constraints.
   * 
   * @async
   * @method createReport
   * @param {Object} payload - Report parameters
   * @param {Object} user - Authenticated requester context
   * @returns {Promise<Object>} Formatted report object details
   */
  async createReport(payload, user) {
    if (!user) {
      throw new ReportServiceError('Access denied: Authentication context missing.', 'UNAUTHORIZED');
    }

    if (!reportUtil.isValidReportType(payload.type)) {
      throw new ReportServiceError(`Invalid report type: ${payload.type}`, 'INVALID_TYPE');
    }

    if (!reportUtil.isValidReportFormat(payload.format)) {
      throw new ReportServiceError(`Invalid report format: ${payload.format}`, 'INVALID_FORMAT');
    }

    // Fetch user department profile details
    const dbUser = await this.reportRepository.getUserWithDepartment(user.id);
    const userDept = dbUser?.department?.name || null;

    let targetFilters = payload.filters ? { ...payload.filters } : {};

    // Validate and enforce role based filters access
    if (user.role === 'ADMIN') {
      // Super Admin: allows arbitrary filtering
    } else {
      // Admin/Editor: Restrict report to their own department
      if (targetFilters.department && targetFilters.department !== userDept) {
        throw new ReportServiceError('Access denied: EDITOR can only generate reports for their own department.', 'ACCESS_DENIED');
      }
      targetFilters.department = userDept;
    }

    const normalizedFilters = reportUtil.normalizeFilters(targetFilters);
    const refNumber = reportUtil.generateReportReference();

    // Create Report database record in QUEUED status
    const reportRecord = await this.reportRepository.createReport({
      refNumber,
      name: payload.name || `${payload.type.split('_').join(' ').toUpperCase()} Report`,
      type: payload.type,
      description: payload.description || null,
      format: payload.format,
      status: 'QUEUED',
      userId: user.id,
      userSnapshot: { id: user.id, email: user.email, role: user.role },
      departmentSnapshot: userDept,
      filters: normalizedFilters,
      sorting: payload.sorting || null,
      columns: payload.columns || null,
    });

    // Append history entry
    await this.reportRepository.createHistoryEntry({
      reportId: reportRecord.id,
      action: 'REQUESTED',
      performedBy: user.email,
      metadata: { userId: user.id },
    });

    // Enqueue BullMQ background generation job
    if (reportQueue.constructor.name === 'MockQueue') {
      // Trigger execution asynchronously in mock offline mode (skip in test environment to avoid background DB pollution)
      if (process.env.NODE_ENV !== 'test') {
        setImmediate(async () => {
          try {
            await this.generateReport(reportRecord.id);
          } catch (err) {
            console.error(`[Mock Report Execution] Failed generating report ID ${reportRecord.id}:`, err);
          }
        });
      }
    } else {
      await reportQueue.add(
        'generate-compliance-report',
        {
          reportId: reportRecord.id,
          reportType: reportRecord.type,
          format: reportRecord.format,
          filters: normalizedFilters,
          requestedBy: { id: user.id, email: user.email, role: user.role },
        },
        { jobId: reportRecord.id }
      );
    }

    return reportUtil.formatReportResponse(reportRecord);
  }

  /**
   * Generates the report binary dataset, compiles PDF, uploads to private storage,
   * and updates report status metadata.
   * 
   * @async
   * @method generateReport
   * @param {string} reportId - Target report ID
   * @returns {Promise<Object>} Completed report details
   */
  async generateReport(reportId) {
    const report = await this.reportRepository.getReportById(reportId);
    if (!report) {
      throw new ReportServiceError('Report record not found.', 'NOT_FOUND');
    }

    // Update status to PROCESSING
    await this.reportRepository.updateReportStatus(reportId, 'PROCESSING', {
      startedAt: new Date(),
    });

    await this.reportRepository.createHistoryEntry({
      reportId,
      action: 'PROCESSING_STARTED',
      performedBy: 'System Engine',
    });

    try {
      // 1. Gather filtered dataset via repositories aggregation routing
      const dataset = await this.collectReportData(report.type, report.filters);

      let fileInfo;
      let contentType;

      if (report.format === 'PDF') {
        const { PDFService } = await import('./pdf.service.js');
        const pdfService = new PDFService();
        const pdfInfo = await pdfService.generateReportPDF(report, dataset);
        fileInfo = pdfInfo;
        contentType = 'application/pdf';
      } else if (report.format === 'EXCEL' || report.format === 'CSV') {
        const { ExportService } = await import('./export.service.js');
        const exportService = new ExportService();
        const exportInfo = await exportService.generateReportExport(report, dataset);
        fileInfo = exportInfo;
        contentType = exportInfo.mimeType;
      } else {
        throw new ReportServiceError(`Format ${report.format} generation is not supported yet.`, 'UNSUPPORTED_FORMAT');
      }

      // Target upload path
      const date = new Date();
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const filename = fileInfo.fileName || `report_${Date.now()}.${report.format === 'PDF' ? 'pdf' : (report.format === 'EXCEL' ? 'xlsx' : 'csv')}`;
      const fileRef = `reports/audit/${year}/${month}/${report.id}/${filename}`;

      // Upload physical file to Supabase/S3 Private Storage bucket
      await StorageService.uploadObject('documents', fileRef, fileInfo.buffer, {
        contentType,
        cacheControl: '300',
      });

      // Calculate metrics
      const completedAt = new Date();
      const startedTime = report.startedAt ? new Date(report.startedAt) : new Date();
      const processingTime = completedAt.getTime() - startedTime.getTime();

      // Persist Generated file info
      const updatedReport = await this.reportRepository.updateGeneratedFileInfo(reportId, {
        storageProvider: 'SUPABASE',
        bucketName: 'documents',
        filePath: fileRef,
        fileName: filename,
        fileSize: fileInfo.fileSize,
        fileHash: fileInfo.fileHash,
        generatedAt: completedAt,
        expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 days retention expiry
      });

      // Mark COMPLETED
      const finalizedReport = await this.reportRepository.updateReportStatus(reportId, 'COMPLETED', {
        completedAt,
        processingTime,
      });

      await this.reportRepository.createHistoryEntry({
        reportId,
        action: 'GENERATED',
        performedBy: 'System Engine',
        metadata: { filePath: fileRef },
      });

      // Trigger integrations hooks placeholder
      if (report.format === 'PDF') {
        this.reportGenerated(finalizedReport);
      } else if (report.format === 'EXCEL') {
        this.excelGenerated(finalizedReport);
      } else if (report.format === 'CSV') {
        this.csvGenerated(finalizedReport);
      }

      return reportUtil.formatReportResponse(finalizedReport);
    } catch (error) {
      console.error(`[ReportService] Failure during report compilation:`, error);
      
      const failedReport = await this.reportRepository.updateReportStatus(reportId, 'FAILED', {
        completedAt: new Date(),
        failureReason: error.message,
      });

      await this.reportRepository.createHistoryEntry({
        reportId,
        action: 'FAILED',
        performedBy: 'System Engine',
        metadata: { error: error.message },
      });

      this.reportFailed(reportId, error);

      throw error;
    }
  }

  /**
   * Retrieve report details, enforcing security RBAC checks.
   * 
   * @async
   * @method getReport
   * @param {string} reportId - Report UUID
   * @param {Object} user - Authenticated user context
   * @returns {Promise<Object>} Formatted report object
   */
  async getReport(reportId, user) {
    if (!user) {
      throw new ReportServiceError('Access denied: Authentication context missing.', 'UNAUTHORIZED');
    }

    const report = await this.reportRepository.getReportById(reportId);
    if (!report) {
      throw new ReportServiceError('Report not found.', 'NOT_FOUND');
    }

    // Super Admin bypass
    if (user.role === 'ADMIN') {
      return reportUtil.formatReportResponse(report);
    }

    const dbUser = await this.reportRepository.getUserWithDepartment(user.id);
    const userDept = dbUser?.department?.name || null;

    // EDITOR/Default can access reports within their own department or their own creations
    if (report.departmentSnapshot === userDept || report.userId === user.id) {
      return reportUtil.formatReportResponse(report);
    }

    throw new ReportServiceError('Access denied: Department scope mismatch or restricted.', 'FORBIDDEN');
  }

  /**
   * Lists reports created by a user.
   */
  async getUserReports(userId, options = {}, user) {
    if (user.role !== 'ADMIN' && user.id !== userId) {
      throw new ReportServiceError('Access denied: Cannot retrieve reports for other users.', 'FORBIDDEN');
    }
    const result = await this.reportRepository.listReports({ userId }, options);
    return {
      reports: result.logs.map(reportUtil.formatReportResponse),
      total: result.total,
    };
  }

  /**
   * Lists reports created for a department.
   */
  async getDepartmentReports(departmentName, options = {}, user) {
    const dbUser = await this.reportRepository.getUserWithDepartment(user.id);
    const userDept = dbUser?.department?.name || null;

    if (user.role !== 'ADMIN' && (user.role !== 'EDITOR' || userDept !== departmentName)) {
      throw new ReportServiceError('Access denied: Department reports restricted.', 'FORBIDDEN');
    }

    const result = await this.reportRepository.listReports({ departmentSnapshot: departmentName }, options);
    return {
      reports: result.logs.map(reportUtil.formatReportResponse),
      total: result.total,
    };
  }

  /**
   * Transition queued report status to ARCHIVED.
   */
  async cancelReport(reportId, user) {
    const report = await this.getReport(reportId, user);
    if (report.status !== 'QUEUED' && report.status !== 'PROCESSING') {
      throw new ReportServiceError('Cannot cancel reports that have already completed or failed.', 'INVALID_TRANSITION');
    }

    const updated = await this.reportRepository.updateReportStatus(reportId, 'ARCHIVED');
    await this.reportRepository.createHistoryEntry({
      reportId,
      action: 'ARCHIVED',
      performedBy: user.email,
      metadata: { reason: 'User cancelled request' },
    });

    return reportUtil.formatReportResponse(updated);
  }

  /**
   * Archive completed reports.
   */
  async archiveReport(reportId, user) {
    const report = await this.getReport(reportId, user);
    if (report.status !== 'COMPLETED') {
      throw new ReportServiceError('Only completed reports can be archived.', 'INVALID_TRANSITION');
    }

    const updated = await this.reportRepository.updateReportStatus(reportId, 'ARCHIVED');
    await this.reportRepository.createHistoryEntry({
      reportId,
      action: 'ARCHIVED',
      performedBy: user.email,
    });

    this.reportArchived(updated);

    return reportUtil.formatReportResponse(updated);
  }

  // =========================================================================
  // Data Collection Router (Internal)
  // =========================================================================

  /**
   * Routing data aggregation collectors based on report type.
   * 
   * @async
   * @method collectReportData
   * @param {string} type - ReportType classification
   * @param {Object} filters - Filter criteria JSON
   * @returns {Promise<Array<Object>>} Resolved datasets list
   */
  async collectReportData(type, filters) {
    switch (type) {
      case 'DOCUMENT_ACTIVITY':
        return await this.collectDocumentData(filters);
      case 'CHECKOUT_REPORT':
      case 'RETURN_REPORT':
        return await this.collectCheckoutData(filters);
      case 'APPROVAL_REPORT':
        return await this.collectApprovalData(filters);
      case 'SIGNATURE_REPORT':
        return await this.collectSignatureData(filters);
      case 'AUDIT_REPORT':
      case 'SECURITY_REPORT':
      case 'COMPLIANCE_REPORT':
      case 'SYSTEM_REPORT':
        return await this.collectAuditData({ ...filters, type });
      case 'USER_ACTIVITY':
        return await this.collectUserActivityData(filters);
      default:
        throw new ReportServiceError(`Unsupported report dataset source: ${type}`, 'UNSUPPORTED_TYPE');
    }
  }

  /**
   * Gather document lifecycle activity metrics.
   */
  async collectDocumentData(filters) {
    const listOptions = {
      departmentId: filters.departmentId,
      classification: filters.classification,
      status: filters.status,
      search: filters.search,
      limit: 100000,
    };
    const result = await this.documentRepository.list(listOptions);
    return result.documents || [];
  }

  /**
   * Gather checkouts.
   */
  async collectCheckoutData(filters) {
    const checkoutFilters = {
      department: filters.department,
      status: filters.status,
      requestedById: filters.userId,
    };
    const result = await this.checkoutRepository.findAll(checkoutFilters, { limit: 100000 });
    return result.checkouts || [];
  }

  /**
   * Gather approvals.
   */
  async collectApprovalData(filters) {
    const result = await this.approvalRepository.findAll({
      requesterId: filters.userId,
      status: filters.status,
    }, { limit: 100000 });
    return result.approvals || [];
  }

  /**
   * Gather signatures.
   */
  async collectSignatureData(filters) {
    const result = await this.signatureRepository.findAll({
      userId: filters.userId,
      status: filters.status,
    }, { limit: 100000 });
    return result.signatures || [];
  }

  /**
   * Gather audit logs trail.
   */
  async collectAuditData(filters) {
    const auditFilters = {
      userId: filters.userId,
      department: filters.department,
      startDate: filters.startDate,
      endDate: filters.endDate,
    };
    // Map specific report categories
    if (filters.type === 'SECURITY_REPORT') {
      auditFilters.category = 'SECURITY';
    } else if (filters.type === 'COMPLIANCE_REPORT') {
      auditFilters.category = 'COMPLIANCE';
    }
    const result = await this.auditRepository.list(auditFilters, { limit: 100000 });
    return result.logs || [];
  }

  /**
   * Gather user activities.
   */
  async collectUserActivityData(filters) {
    const auditFilters = {
      userId: filters.userId,
      department: filters.department,
      startDate: filters.startDate,
      endDate: filters.endDate,
    };
    const result = await this.auditRepository.list(auditFilters, { limit: 100000 });
    return result.logs || [];
  }

  // =========================================================================
  // Analytics Dashboard Gatherer
  // =========================================================================

  /**
   * Retrieves aggregated statistics for charts visualization.
   * 
   * @async
   * @method getDashboardAnalytics
   * @param {Object} user - Authenticated caller context
   * @returns {Promise<Object>} Aggregated analytics data object
   */
  async getDashboardAnalytics(user) {
    if (user.role !== 'ADMIN') {
      throw new ReportServiceError('Access denied: Analytics dashboards require ADMIN privilege.', 'FORBIDDEN');
    }

    const [docs, checkouts, approvals, signatures, audits, users] = await Promise.all([
      this.reportRepository.getDocumentStats(),
      this.reportRepository.getCheckoutStats(),
      this.reportRepository.getApprovalStats(),
      this.reportRepository.getSignatureStats(),
      this.reportRepository.getAuditStats(),
      this.reportRepository.getUserActivityStats(),
    ]);

    return {
      documents: docs,
      checkouts,
      approvals,
      signatures,
      auditLogs: audits,
      userActivity: users,
    };
  }

  // =========================================================================
  // Integration Hooks (Placeholders)
  // =========================================================================

  reportRequested(report) {
    // Hook for audit trails or socket updates
  }

  reportGenerated(report) {
    // Hook for email notify triggers
  }

  excelGenerated(report) {
    // Hook for excel generation notifications
  }

  csvGenerated(report) {
    // Hook for csv generation notifications
  }

  reportFailed(reportId, error) {
    // Hook for alarm alerts notifications
  }

  reportArchived(report) {
    // Hook
  }
}

export default ReportService;
