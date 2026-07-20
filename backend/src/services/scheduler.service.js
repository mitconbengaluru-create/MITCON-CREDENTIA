import { ReportRepository } from '../repositories/report.repository.js';
import { ReportService } from './report.service.js';
import * as schedulerUtil from '../utils/scheduler.util.js';
import { prisma } from '../config/database.js';

const reportRepository = new ReportRepository();
const reportService = new ReportService();

export class SchedulerServiceError extends Error {
  constructor(message, code = 'SCHEDULER_ERROR') {
    super(message);
    this.name = 'SchedulerServiceError';
    this.code = code;
  }
}

export class SchedulerService {
  /**
   * Helper permission resolution check.
   */
  async checkPermission(userId, requiredPermission) {
    // Import auth middleware resolution logic dynamically to prevent circular deps
    const { PermissionResolutionService } = await import('./auth/permission.service.js').catch(() => ({
      PermissionResolutionService: class {
        async hasPermission(uid, perm) {
          // Fallback if not found: resolve from user role
          const user = await prisma.user.findUnique({ where: { id: uid } });
          if (!user) return false;
          if (user.role === 'ADMIN') return true;
          if (perm === 'REPORT_SCHEDULE_CREATE') return user.role === 'EDITOR' || user.role === 'ADMIN';
          if (perm === 'REPORT_SCHEDULE_MANAGE') return user.role === 'EDITOR' || user.role === 'ADMIN';
          return false;
        }
      }
    }));
    const permService = new PermissionResolutionService();
    const hasPerm = await permService.hasPermission(userId, requiredPermission);
    if (!hasPerm) {
      throw new SchedulerServiceError(`Access denied: Missing required permission ${requiredPermission}`, 'FORBIDDEN');
    }
  }

  /**
   * Creates a new recurring report schedule configuration.
   */
  async createSchedule(payload, user) {
    await this.checkPermission(user.id, 'REPORT_SCHEDULE_CREATE');

    if (!schedulerUtil.isValidFrequency(payload.frequency)) {
      throw new SchedulerServiceError(`Invalid frequency option: ${payload.frequency}`, 'INVALID_FREQUENCY');
    }

    const nextExecution = schedulerUtil.calculateNextExecutionTime(payload.frequency, payload.startDate || new Date());

    const schedule = await reportRepository.createSchedule({
      name: payload.name || `Scheduled ${payload.reportType} Report`,
      reportType: payload.reportType,
      format: payload.format,
      frequency: payload.frequency.toUpperCase(),
      recipients: payload.recipients || [user.email],
      filters: payload.filters || {},
      sorting: payload.sorting || {},
      columns: payload.columns || [],
      nextExecutionTime: nextExecution,
      isActive: true,
      ownerId: user.id,
    });

    return schedule;
  }

  /**
   * Updates an existing report schedule configuration.
   */
  async updateSchedule(id, payload, user) {
    await this.checkPermission(user.id, 'REPORT_SCHEDULE_MANAGE');

    const existing = await prisma.scheduledReport.findUnique({ where: { id } });
    if (!existing) {
      throw new SchedulerServiceError('Scheduled report config not found', 'NOT_FOUND');
    }

    const updateData = { ...payload };

    if (payload.frequency && payload.frequency !== existing.frequency) {
      if (!schedulerUtil.isValidFrequency(payload.frequency)) {
        throw new SchedulerServiceError(`Invalid frequency option: ${payload.frequency}`, 'INVALID_FREQUENCY');
      }
      updateData.nextExecutionTime = schedulerUtil.calculateNextExecutionTime(payload.frequency, new Date());
    }

    const updated = await reportRepository.updateSchedule(id, updateData);
    return updated;
  }

  /**
   * Disables an active scheduled report configuration.
   */
  async disableSchedule(id, user) {
    await this.checkPermission(user.id, 'REPORT_SCHEDULE_MANAGE');

    const existing = await prisma.scheduledReport.findUnique({ where: { id } });
    if (!existing) {
      throw new SchedulerServiceError('Scheduled report config not found', 'NOT_FOUND');
    }

    const disabled = await reportRepository.disableSchedule(id);
    return disabled;
  }

  /**
   * Performs the actual execution run for a due schedule.
   */
  async executeScheduledReport(scheduleId) {
    const schedule = await prisma.scheduledReport.findUnique({
      where: { id: scheduleId },
      include: { owner: true }
    });

    if (!schedule || !schedule.isActive) {
      throw new SchedulerServiceError('Scheduled report configuration is missing or inactive', 'INVALID_SCHEDULE');
    }

    const owner = schedule.owner;
    if (!owner) {
      throw new SchedulerServiceError('Owner profile for scheduled report is missing', 'INVALID_OWNER');
    }

    // Trigger report creation payload on behalf of schedule owner
    const reportPayload = {
      type: schedule.reportType,
      format: schedule.format,
      filters: schedule.filters || {},
      sorting: schedule.sorting || {},
      columns: schedule.columns || [],
      scheduledReportId: schedule.id,
      name: `${schedule.name} - ${new Date().toISOString().split('T')[0]}`,
    };

    // Create and execute report generation
    const reportResponse = await reportService.createReport(reportPayload, {
      id: owner.id,
      email: owner.email,
      role: owner.role,
    });

    // Compute and persist the next execution time
    const nextExecution = schedulerUtil.calculateNextExecutionTime(schedule.frequency, new Date());
    await reportRepository.updateSchedule(schedule.id, {
      nextExecutionTime: nextExecution,
    });

    // Future hooks placeholders
    this.scheduledReportCompleted?.(schedule.id, reportResponse.id);

    return reportResponse;
  }

  /**
   * Scans and executes all due schedules.
   */
  async processPendingSchedules() {
    const dueSchedules = await reportRepository.listDueSchedules(new Date());
    const results = [];

    for (const schedule of dueSchedules) {
      try {
        const res = await this.executeScheduledReport(schedule.id);
        results.push({ scheduleId: schedule.id, success: true, reportId: res.id });
      } catch (err) {
        console.error(`[SchedulerService] Failure executing schedule ${schedule.id}:`, err);
        results.push({ scheduleId: schedule.id, success: false, error: err.message });
      }
    }

    return results;
  }

  // ==========================================
  // Future Integration Hooks
  // ==========================================
  scheduledReportStarted(scheduleId) {}
  scheduledReportCompleted(scheduleId, reportId) {}
  scheduledReportFailed(scheduleId, error) {}
}
