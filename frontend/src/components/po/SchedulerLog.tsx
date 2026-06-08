import { Clock, Calendar } from 'lucide-react'
import { formatTs } from '@/lib/utils'

interface Job {
  job_id: string
  next_run: string
  label: string
  vendor_name: string
}

interface SchedulerLogProps {
  jobs: Job[]
}

export default function SchedulerLog({ jobs }: SchedulerLogProps) {
  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
        <Clock size={28} className="mx-auto mb-2 opacity-30" />
        No scheduler jobs found.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <Calendar size={16} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">Scheduler Jobs</h3>
        <span className="ml-auto text-xs text-slate-400">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Schedule</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Next Fire</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {jobs.map((job) => (
            <tr key={job.job_id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-5 py-3">
                <p className="text-sm font-medium text-slate-700">{job.label}</p>
                {job.vendor_name && (
                  <p className="text-xs text-slate-400 mt-0.5">{job.vendor_name}</p>
                )}
              </td>
              <td className="px-5 py-3 text-sm text-slate-600">
                {job.next_run ? formatTs(job.next_run) : <span className="text-slate-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
