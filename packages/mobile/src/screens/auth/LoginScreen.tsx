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
import { Activity, ShieldCheck, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import Logo from '../../components/Logo';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const checkBiometric = async () => {
      try {
        const result = await NativeBiometric.isAvailable();
        if (result.isAvailable) setBiometricAvailable(true);
      } catch (e) {
        console.log("Biometric not available", e);
      }
    };
    checkBiometric();
  }, []);

  const handleBiometricLogin = async () => {
    try {
      let credentials;
      try {
        credentials = await NativeBiometric.getCredentials({ server: "rayhealth.evv" });
      } catch (err) {
        toast.error('No saved credentials. Please login with email/password first.');
        return;
      }

      if (credentials && credentials.username && credentials.password) {
        await NativeBiometric.verifyIdentity({
          reason: "Authenticate to login to RayHealth EVV",
          title: "Biometric Login"
        });
        setIsLoading(true);
        await login(credentials.username, credentials.password);
        toast.success('Welcome back!');
        navigate('/');
      } else {
        toast.error('No credentials stored. Please login manually first.');
      }
    } catch (error) {
      toast.error('Biometric verification cancelled or failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      // Save credentials for future biometric login
      try {
        await NativeBiometric.setCredentials({
          username: email,
          password: password,
          server: "rayhealth.evv"
        });
      } catch (e) {
        console.log("Failed to save credentials for biometrics", e);
      }
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed. Please check your credentials.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-medical-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-medical-500/5 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-pulse-orange/5 rounded-full blur-[100px]" />

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 relative z-10">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center space-y-6"
        >
          <Logo variant="icon" size="lg" className="shadow-2xl rounded-[2rem]" />
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tighter text-medical-700 font-heading">
              RayHealth<span className="text-pulse-orange">EVV</span>
            </h1>
            <p className="text-[10px] font-bold text-medical-300 uppercase tracking-[0.4em] mt-1">
              Verify · Care · Deliver
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-sm"
        >
          <Card className="w-full medical-card border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/90 backdrop-blur-xl">
            <CardHeader className="space-y-1.5 pb-2 pt-8 px-8">
              <CardTitle className="text-2xl font-black font-heading text-medical-700 flex items-center gap-2">
                Secure Login
                <ShieldCheck className="w-5 h-5 text-medical-500" />
              </CardTitle>
              <CardDescription className="font-bold text-medical-400 text-[10px] uppercase tracking-widest">
                Agency Portal Authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 px-8 pb-8">
              <form onSubmit={handleLogin} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-medical-500 ml-1">Agency Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="caregiver@rayhealth.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-2xl h-14 bg-medical-50/50 border-medical-50 placeholder:text-medical-200 focus:ring-2 focus:ring-medical-500/20 px-4 font-bold text-medical-700"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-medical-500">Secure Pin</Label>
                    <Link to="/auth/forgot-password" disable-nav="true" className="text-[10px] text-medical-500 hover:underline font-bold uppercase tracking-tight">Forgot Pin?</Link>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-2xl h-14 bg-medical-50/50 border-medical-50 focus:ring-2 focus:ring-medical-500/20 px-4 font-bold text-medical-700"
                  />
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <Button disabled={isLoading} className="w-full h-14 button-primary text-base">
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                          <Activity className="w-4 h-4" />
                        </motion.div>
                        Connecting...
                      </div>
                    ) : 'AUTHENTICATE'}
                  </Button>

                  {biometricAvailable && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBiometricLogin}
                      disabled={isLoading}
                      className="w-full h-14 border-medical-200 text-medical-600 rounded-2xl flex items-center gap-2"
                    >
                      <Fingerprint className="w-5 h-5" />
                      FACE ID / BIO LOGIN
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
            
            <CardFooter className="flex flex-col space-y-4 px-8 pb-8 pt-0">
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-medical-50" />
                </div>
                <div className="relative flex justify-center text-[9px] uppercase tracking-[0.2em]">
                  <span className="bg-white/80 px-4 text-medical-200 font-bold">New User</span>
                </div>
              </div>
              <Button variant="ghost" className="w-full h-12 rounded-2xl font-bold text-medical-400 uppercase text-[10px] tracking-widest hover:bg-medical-50 hover:text-medical-600" asChild>
                <Link to="/onboarding/access-code">
                  Request Agency Access
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </motion.div>

        <div className="text-center space-y-2">
          <p className="text-[9px] font-bold text-medical-200 uppercase tracking-[0.3em]">
            State Verified · HIPAA Compliant · RayHealth™
          </p>
        </div>
      </div>
    </div>
  );
}
