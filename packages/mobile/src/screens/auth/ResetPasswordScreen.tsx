/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { motion } from 'motion/react';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPasswordScreen() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token') || searchParams.get('oobCode');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { confirmPasswordReset } = useAuth();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) {
      toast.error('Invalid or missing reset token.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await confirmPasswordReset(resetToken, password);
      toast.success('Password updated successfully!');
      navigate('/auth/login');
    } catch (error: any) {
      console.error('Reset Error:', error);
      toast.error(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>This password reset link is invalid or has expired.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/auth/forgot-password">Back to Forgot Password</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">New Password</CardTitle>
          <CardDescription>Enter your new password below to reset your access.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleReset} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">New Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="********" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl h-12"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                placeholder="********" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-xl h-12"
                required
              />
            </div>
            <Button disabled={isLoading} className="w-full h-12 rounded-xl text-lg font-semibold shadow-md mt-2">
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
