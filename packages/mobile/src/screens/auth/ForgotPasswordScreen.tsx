/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { motion } from 'motion/react';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const { sendPasswordReset } = useAuth();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordReset(email);
      setIsSent(true);
      toast.success('Password reset email sent!');
    } catch (error: any) {
      console.error('Reset Error:', error);
      toast.error(error.message || 'Failed to send reset email. Please check the email address and your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6 space-y-8 bg-gradient-to-b from-white to-slate-50"
    >
      <div className="flex flex-col items-center space-y-2">
        <div className="p-3 bg-primary rounded-2xl shadow-lg">
          <KeyRound className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold tracking-tighter text-slate-900">RayHealth <span className="text-primary">EVV</span></h1>
        <p className="text-slate-500 text-sm">Security & Access</p>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>
            {isSent 
              ? "Check your inbox for instructions to reset your password."
              : "Enter your email address and we'll send you a link to reset your password."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!isSent ? (
            <form onSubmit={handleReset} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl h-12"
                  required
                />
              </div>
              <Button disabled={isLoading} className="w-full h-12 rounded-xl text-lg font-semibold shadow-md mt-2">
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">Email Sent!</p>
                <p className="text-sm text-slate-500">We've sent a password reset link to <span className="font-medium text-slate-700">{email}</span></p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center border-t border-slate-50 pt-6">
          <Button variant="ghost" asChild className="text-slate-500 hover:text-primary">
            <Link to="/auth/login" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </Button>
        </CardFooter>
      </Card>

      <div className="text-center text-xs text-slate-400 font-medium">
        &copy; 2026 RayHealth EVV. All rights reserved.
      </div>
    </motion.div>
  );
}
