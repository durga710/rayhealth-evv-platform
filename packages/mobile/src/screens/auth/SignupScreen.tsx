/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'motion/react';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function SignupScreen() {
  const { validateInvite } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const code = new URLSearchParams(location.search).get('code');

  useEffect(() => {
    let active = true;

    const resolveInvite = async () => {
      if (!code) {
        toast.error('Access code required for signup.');
        navigate('/onboarding/access-code');
        return;
      }

      try {
        const invite = await validateInvite(code);
        if (!invite) {
          toast.error('Invitation not found.');
          navigate('/onboarding/access-code');
          return;
        }

        if (!invite.isValid) {
          const message =
            invite.status === 'EXPIRED'
              ? 'This invitation has expired.'
              : invite.status === 'ACCEPTED'
                ? 'This invitation has already been used.'
                : 'This invitation is no longer active.';

          toast.error(message);
          navigate('/login');
          return;
        }

        if (active) {
          navigate(`/onboarding/invite/${invite.token}`, { replace: true });
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Security verification failed.');
        navigate('/login');
      }
    };

    void resolveInvite();

    return () => {
      active = false;
    };
  }, [code, navigate, validateInvite]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-b from-white to-slate-50"
    >
      <Card className="w-full max-w-md border-none shadow-2xl bg-white/90 backdrop-blur-sm">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto p-3 bg-primary rounded-2xl shadow-lg w-fit">
            <UserPlus className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle>Preparing your RayHealth account</CardTitle>
          <CardDescription>
            We&apos;re verifying your access code and loading your caregiver invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </CardContent>
      </Card>
    </motion.div>
  );
}
