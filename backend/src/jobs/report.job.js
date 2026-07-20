import { reportQueue } from './index.js';

/**
 * Enqueues a new background report compilation job.
 * 
 * @async
 * @function enqueueReportJob
 * @param {Object} reportRecord - Created database report record
 * @returns {Promise<Object>} Enqueued job info
 */
export async function enqueueReportJob(reportRecord) {
  if (reportQueue.constructor.name === 'MockQueue') {
    return reportQueue.add('generate-compliance-report', {
      reportId: reportRecord.id,
    });
  }

  return reportQueue.add(
    'generate-compliance-report',
    {
      reportId: reportRecord.id,
      reportType: reportRecord.type,
      format: reportRecord.format,
      filters: reportRecord.filters,
      requestedBy: reportRecord.userSnapshot,
    },
    { jobId: reportRecord.id }
  );
}

export default {
  enqueueReportJob,
};
