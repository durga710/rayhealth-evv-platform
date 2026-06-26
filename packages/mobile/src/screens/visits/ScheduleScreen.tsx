/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../../components/layout/BottomNav';
import { Calendar as CalendarIcon, MapPin, ChevronRight } from 'lucide-react';
import { rayhealthApi } from '../../services/rayhealth-api';
import type { TodayScheduleRow } from '../../services/rayhealth-contract';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return ms >= 0 ? 'in <1 min' : 'just now';
  if (minutes < 60) return ms >= 0 ? `in ${minutes} min` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return ms >= 0 ? `in ${hours} h` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return ms >= 0 ? `in ${days} d` : `${days} d ago`;
}

function statusBadge(row: TodayScheduleRow): { label: string; cls: string } {
  if (row.currentVisitStatus === 'verified' || row.currentVisitStatus === 'corrected') {
    return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }
  if (row.currentVisitStatus === 'pending') {
    return { label: 'In progress', cls: 'bg-amber-50 text-amber-700 border-amber-100' };
  }
  if (row.scheduledStartTime && new Date(row.scheduledStartTime).getTime() < Date.now()) {
    return { label: 'Due now', cls: 'bg-orange-50 text-orange-700 border-orange-100' };
  }
  return { label: 'Scheduled', cls: 'bg-medical-50 text-medical-700 border-medical-100' };
}

export default function ScheduleScreen() {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<TodayScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await rayhealthApi.getTodaysSchedule();
        if (cancelled) return;
        setSchedule(r.schedule);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message ?? 'Could not load your schedule.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-medical-50 pb-24">
      <header className="bg-white px-6 py-4 safe-area-top shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border-b border-medical-100 flex items-center gap-3 z-20 sticky top-0">
        <CalendarIcon className="w-5 h-5 text-medical-600" />
        <h1 className="text-lg font-black text-medical-700 font-heading tracking-tight">
          Today's Schedule
        </h1>
      </header>

      <main className="flex-1 px-6 pt-6 pb-10">
        {loading && (
          <div className="text-center py-20 text-medical-300 text-sm font-bold">
            Loading…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-5 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && schedule.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <CalendarIcon className="w-16 h-16 text-medical-200 mx-auto" />
            <div>
              <h2 className="text-lg font-bold text-medical-700 font-heading">
                No visits scheduled for today
              </h2>
              <p className="text-sm text-medical-400 mt-1">
                Your coordinator hasn't assigned any visits in the next 24 hours.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && schedule.length > 0 && (
          <ul className="space-y-3">
            {schedule.map((row) => {
              const badge = statusBadge(row);
              const fullName = `${row.clientFirstName} ${row.clientLastName}`.trim();
              const addressLine =
                [row.clientAddressLine1, row.clientCity, row.clientState]
                  .filter(Boolean)
                  .join(', ') || 'Address not set';
              const targetVisitId = row.currentVisitId;
              return (
                <li key={row.assignmentId}>
                  <button
                    type="button"
                    onClick={() => {
                      if (targetVisitId) {
                        navigate(`/visits/${targetVisitId}`);
                      }
                    }}
                    className="w-full text-left bg-white rounded-2xl border border-medical-100 p-5 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] active:scale-[0.99] transition-transform"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-black text-medical-700 font-heading truncate">
                            {fullName}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-medical-500 mt-1">
                          {formatTime(row.scheduledStartTime)} — {formatTime(row.scheduledEndTime)}
                          <span className="text-medical-300 font-normal ml-2">
                            {row.scheduledStartTime ? formatRelative(row.scheduledStartTime) : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-medical-400">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{addressLine}</span>
                        </div>
                        {row.geofenceRadiusM > 0 && (
                          <div className="text-[11px] text-medical-300 mt-1">
                            Geofence: {row.geofenceRadiusM} m
                          </div>
                        )}
                      </div>
                      {targetVisitId && (
                        <ChevronRight className="w-5 h-5 text-medical-300 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
