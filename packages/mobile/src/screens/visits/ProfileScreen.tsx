/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import BottomNav from '../../components/layout/BottomNav';
import { LogOut, User, Settings, Shield, Bell, Camera, Lock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfileScreen() {
  const { user, logout, updateUser, changePassword } = useAuth();
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProfilePicClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In a real app, upload to Firebase Storage
    // For this demo, we'll use a local data URL
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setIsUpdating(true);
        await updateUser({ photoURL: reader.result as string });
        toast.success('Profile picture updated');
      } catch (err) {
        toast.error('Failed to update profile picture');
      } finally {
        setIsUpdating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = async () => {
    if (!currentPassword) {
      toast.error('Enter your current password');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setIsUpdating(true);
      await changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPass(false);
    } catch (err: any) {
      console.error('Detailed Error:', err);
      toast.error(err.message || 'Failed to change password. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-medical-50 pb-24">
      <header className="bg-white px-8 pt-16 pb-10 safe-area-top flex flex-col items-center space-y-5 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border-b border-medical-100 relative">
        <div className="relative group cursor-pointer" onClick={handleProfilePicClick}>
          <div className="absolute inset-0 bg-medical-500/20 blur-2xl rounded-full" />
          <Avatar className="w-28 h-28 border-4 border-white shadow-2xl relative overflow-hidden">
            <AvatarImage src={user?.photoURL} className="object-cover" />
            <AvatarFallback className="bg-medical-500 text-white text-4xl font-black font-heading">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="w-8 h-8 text-white" />
            </div>
          </Avatar>
          <div className="absolute bottom-1 right-1 bg-medical-600 text-white p-2 rounded-full shadow-lg border-2 border-white">
            <Camera className="w-4 h-4" />
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange}
          />
        </div>
        
        <div className="text-center">
          <h2 className="text-2xl font-black font-heading text-medical-700 tracking-tight leading-none mb-2">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-medical-300 font-bold text-xs uppercase tracking-widest">{user?.email}</p>
          <div className="mt-4 flex justify-center">
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] uppercase font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 className="w-3 h-3" />
              Verified Caregiver
            </Badge>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-8">
        <div className="space-y-4">
          <h3 className="text-[11px] font-black text-medical-300 uppercase tracking-[0.2em] ml-2 font-heading">Manage Account</h3>
          <Card className="medical-card border-none overflow-hidden shadow-xl shadow-medical-500/5">
            <CardContent className="p-0">
              <div className="divide-y divide-medical-50">
                <Button
                  variant="ghost"
                  className="w-full h-16 flex items-center justify-between px-6 hover:bg-medical-50 rounded-none"
                  onClick={() =>
                    toast('Clinical Profile is coming soon', {
                      description: 'Editing your credentials and certifications will be available in the next release.',
                    })
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-medical-50 rounded-xl text-medical-600">
                      <User className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm text-medical-700 font-heading">Clinical Profile</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-medical-200" />
                </Button>

                <Dialog open={isChangingPass} onOpenChange={setIsChangingPass}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="w-full h-16 flex items-center justify-between px-6 hover:bg-medical-50 rounded-none cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-medical-50 rounded-xl text-medical-600">
                          <Lock className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-sm text-medical-700 font-heading">Change Password</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-medical-200" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-3xl border-none">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black text-medical-700 font-heading">Security Update</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-medical-300 uppercase tracking-widest">Current Password</Label>
                        <Input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="rounded-xl border-medical-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-medical-300 uppercase tracking-widest">New Password</Label>
                        <Input 
                          type="password" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="rounded-xl border-medical-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-medical-300 uppercase tracking-widest">Confirm Password</Label>
                        <Input 
                          type="password" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="rounded-xl border-medical-100"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handlePasswordChange} disabled={isUpdating} className="w-full button-primary h-12">
                        {isUpdating ? 'Updating...' : 'Update Password'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="ghost"
                  className="w-full h-16 flex items-center justify-between px-6 hover:bg-medical-50 rounded-none"
                  onClick={() =>
                    toast('Notification preferences are coming soon', {
                      description: '30-second pre-clock reminders are on by default. Per-channel controls land in the next release.',
                    })
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-medical-50 rounded-xl text-medical-600">
                      <Bell className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm text-medical-700 font-heading">Notification Tuning</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-medical-200" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Button 
            variant="destructive" 
            className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-destructive/20 active:scale-[0.98] transition-all" 
            onClick={() => { void logout(); }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Terminate Session
          </Button>
          <p className="text-[10px] font-black text-center text-medical-300 uppercase tracking-[0.2em] italic">
            RayHealth EVV Native v1.2.5
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
