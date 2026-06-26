/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { motion } from 'motion/react';
import { ChevronLeft, Key, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AccessCodeScreen() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { validateInvite } = useAuth();
  const navigate = useNavigate();

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      toast.error('Please enter an access code');
      return;
    }

    setIsLoading(true);
    try {
      const invite = await validateInvite(code);
      if (invite?.isValid) {
        toast.success('Code verified!');
        navigate(`/onboarding/invite/${invite.token}`);
      } else if (invite?.status === 'EXPIRED') {
        toast.error('This access code has expired. Ask your agency to send a new invite.');
      } else if (invite?.status === 'ACCEPTED') {
        toast.error('This access code was already used. Please sign in instead.');
      } else if (invite?.status === 'REVOKED') {
        toast.error('This invitation was revoked. Please contact your agency.');
      } else {
        toast.error('Invalid access code. Please check with your supervisor.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col min-h-screen p-6 bg-slate-50"
    >
      <div className="safe-area-top mb-8">
        <Button variant="ghost" className="p-0 hover:bg-transparent -ml-2" onClick={() => navigate('/login')}>
          <ChevronLeft className="w-6 h-6 mr-1" />
          Back to Login
        </Button>
      </div>

      <div className="flex-1 flex flex-col space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Onboarding</h1>
          <p className="text-slate-500">Join your organization by entering the access code provided to you.</p>
        </div>

        <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-primary p-6 flex justify-center">
            <Key className="w-12 h-12 text-primary-foreground opacity-90" />
          </div>
          <CardHeader>
            <CardTitle>Enter Access Code</CardTitle>
            <CardDescription>This was sent to your email or given by your supervisor.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleValidate} className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-center flex-wrap gap-2">
                  <Input 
                    placeholder="Enter your 8-digit code"
                    className="h-14 text-center text-2xl tracking-[0.5em] font-mono rounded-xl uppercase border-2 focus-visible:border-primary"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={12}
                    autoFocus
                  />
                </div>
                
                <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                    <p className="text-xs text-slate-600">Securely verify your identity</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                    <p className="text-xs text-slate-600">Connect to your organization profile</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                    <p className="text-xs text-slate-600">Receive schedule and patient data</p>
                  </div>
                </div>
              </div>

              <Button disabled={isLoading} className="w-full h-14 rounded-xl text-lg font-bold">
                {isLoading ? 'Verifying...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-auto text-center p-6 space-y-4">
          <p className="text-sm text-slate-500">
            Having trouble? Contact your agency supervisor or reach out to RayHealth Support.
          </p>
          <div className="flex justify-center space-x-6 text-xs text-primary font-semibold">
            <Link to="#" className="hover:underline">Need Help?</Link>
            <Link to="#" className="hover:underline">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
