/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { motion } from 'motion/react';
import { User, Mail, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function AcceptInviteScreen() {
  const { token } = useParams<{ token: string }>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [organizationName, setOrganizationName] = useState('RayHealth EVV');
  const [inviteEmail, setInviteEmail] = useState('');
  const { acceptInvite, validateInvite } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        toast.error('Invalid invitation link.');
        navigate('/login');
        return;
      }
      try {
        const invite = await validateInvite(token);
        if (!invite) {
          toast.error('Invitation expired or invalid.');
          navigate('/login');
        } else if (!invite.isValid) {
          const message =
            invite.status === 'EXPIRED'
              ? 'Invitation expired. Ask the agency to resend it.'
              : invite.status === 'ACCEPTED'
                ? 'Invitation already used. Please sign in instead.'
                : 'Invitation is no longer active.';
          toast.error(message);
          navigate('/login');
        } else {
          setOrganizationName(invite.organizationName);
          setInviteEmail(invite.email);
          setFirstName(invite.firstName ?? '');
          setLastName(invite.lastName ?? '');
        }
      } catch (err) {
        navigate('/login');
      } finally {
        setIsValidating(false);
      }
    };
    checkToken();
  }, [token, validateInvite, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await acceptInvite(token || '', {
        firstName,
        lastName,
        password,
      });
      toast.success('Account created successfully!');
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col min-h-screen p-6 bg-slate-50"
    >
      <div className="safe-area-top mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Complete Profile</h1>
        <p className="text-slate-500">You&apos;re joining <span className="font-semibold text-slate-900">{organizationName}</span></p>
      </div>

      <Card className="border-none shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle>Welcome!</CardTitle>
          <CardDescription>Tell us a bit about yourself to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input 
                    id="firstName" 
                    placeholder="John" 
                    className="pl-9 h-11 rounded-xl"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input 
                  id="lastName" 
                  placeholder="Doe" 
                  className="h-11 rounded-xl"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input 
                  id="email" 
                  type="email" 
                  value={inviteEmail} 
                  disabled 
                  className="pl-9 h-11 rounded-xl bg-slate-100 italic"
                />
              </div>
              <p className="text-[10px] text-slate-400">Email is pre-filled from your invitation.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-9 h-11 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  className="pl-9 h-11 rounded-xl"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <Button disabled={isLoading} className="w-full h-12 rounded-xl text-lg font-bold mt-4 shadow-lg shadow-primary/20">
              {isLoading ? 'Setting up...' : 'Create Account'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col items-center space-y-4 opacity-60">
        <div className="flex -space-x-2">
          {[1,2,3,4].map(i => (
             <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200"></div>
          ))}
        </div>
        <p className="text-xs font-medium text-slate-500">Join 40+ caregivers at this agency</p>
      </div>
    </motion.div>
  );
}
