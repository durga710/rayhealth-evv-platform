/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Award, BookOpen, Clock, ChevronRight, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import BottomNav from '../../components/layout/BottomNav';
import Logo from '../../components/Logo';

export default function LearningScreen() {
  const courses = [
    {
      id: 1,
      title: "HIPAA Compliance Fundamentals",
      duration: "45 mins",
      status: "Required",
      progress: 100,
      icon: BookOpen,
      color: "text-blue-500",
      bg: "bg-blue-50"
    },
    {
      id: 2,
      title: "Emergency Response & First Aid",
      duration: "1h 30m",
      status: "In Progress",
      progress: 30,
      icon: PlayCircle,
      color: "text-pulse-orange",
      bg: "bg-orange-50"
    },
    {
      id: 3,
      title: "EVV System Best Practices",
      duration: "30 mins",
      status: "Not Started",
      progress: 0,
      icon: Award,
      color: "text-emerald-500",
      bg: "bg-emerald-50"
    }
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-medical-50 pb-32">
      <header className="bg-white px-6 py-4 safe-area-top shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border-b border-medical-100 flex flex-col justify-end z-20 sticky top-0 min-h-[100px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-medical-700 font-heading">RayHealth Academy</h1>
            <p className="text-[11px] font-bold text-medical-400 uppercase tracking-wider mt-1">Caregiver Excellence</p>
          </div>
          <Logo size="sm" className="h-8" />
        </div>
      </header>

      <div className="flex-1 px-6 pt-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="bg-gradient-to-br from-medical-600 to-medical-500 border-none shadow-xl text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold font-heading">Annual Training</h2>
                  <p className="text-medical-100 text-sm opacity-90">You have 2 pending courses to maintain certification.</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                  <Award className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="mt-6">
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span>Overall Progress</span>
                  <span>45%</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-pulse-orange rounded-full w-[45%]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div
          role="note"
          className="mb-6 rounded-2xl border border-medical-100 bg-white p-4 flex items-start gap-3"
        >
          <Info className="w-4 h-4 mt-0.5 text-medical-400 shrink-0" />
          <p className="text-xs text-medical-500 font-medium leading-relaxed">
            <strong className="text-medical-700">Academy preview.</strong>{' '}
            Course content goes live in the next release. Tap a course to
            register interest and we'll notify you when it's available.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-black text-medical-700 uppercase tracking-wider">Required Courses</h3>

          {courses.map((course, idx) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card
                className="medical-card overflow-hidden hover:shadow-lg transition-all cursor-pointer group active:scale-95 border-none"
                onClick={() =>
                  toast(`${course.title} is coming soon`, {
                    description:
                      'We’ll send you a notification when this course is available.',
                  })
                }
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${course.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                    <course.icon className={`w-6 h-6 ${course.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-bold text-medical-700 truncate font-heading">{course.title}</h4>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-medical-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {course.duration}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-medical-200" />
                      <span className={course.progress === 100 ? "text-emerald-500 font-bold" : ""}>
                        {course.status}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-medical-50 text-medical-400 group-hover:bg-medical-600 group-hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5 ml-0.5" />
                  </div>
                </CardContent>
                {course.progress > 0 && course.progress < 100 && (
                  <div className="h-1 bg-medical-50 w-full">
                    <div className="h-full bg-pulse-orange" style={{ width: `${course.progress}%` }} />
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center">
           <Button variant="outline" className="rounded-xl border-medical-200 text-medical-600 font-bold w-full h-12" onClick={() => window.open('https://rayhealthevv.com', '_blank')}>
              Access Full Learning Portal
           </Button>
           <p className="text-[10px] text-medical-300 mt-4 uppercase tracking-widest font-bold">Powered by RayHealth EVV</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
